// Mezcla: lista de señales (cue) + música opcional con ducking -> una pista de audio lista para el video.
// `planMezcla` es una función pura que arma las entradas y el filtergraph de ffmpeg (que entrega la
// música y los efectos por separado, sin dinámica). El ducking, la normalización de sonoridad y el
// limitador de pico verdadero se aplican después en memoria (`dinamica.ts`, `sonoridad.ts`).
import { existsSync } from 'node:fs';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import { analizarEfecto, aplicarCurva, curvaDeDucking, limitar, type VentanaDuck } from './dinamica';
import { colocarVoz, type VozOpts } from './voz';
import { avisoMp3SinEtiqueta, codificar, decodificar, runFfmpeg, sondear } from './ffmpeg';
import { picoVerdaderoDb } from './medidas';
import { sonoridadIntegrada } from './sonoridad';

export interface Cue {
  frame: number;
  /** Nombre de un efecto (`tilde`, se busca `<carpeta>/tilde.wav`) o ruta a un archivo. */
  sfx: string;
  /** Multiplicador lineal; 1 por defecto. */
  gain?: number;
  /**
   * Qué parte del efecto cae en `frame`: `inicio` (por defecto) o `pico` (el instante más fuerte del
   * efecto; útil en los que tardan en llegar a su pico, como `barrido`, `tilde` o `aviso`).
   */
  ancla?: 'inicio' | 'pico';
}

export interface MusicaOpts {
  archivo: string;
  /** Multiplicador lineal; 0,6 por defecto. */
  gain?: number;
  /** Segundo de la música desde el que arrancar. */
  desdeSec?: number;
  fadeInSec?: number;
  /** Caída al final del video (1 s por defecto). */
  fadeOutSec?: number;
}

export type { VozOpts } from './voz';

export interface DuckOpts {
  /** Cuánto baja la música (dB) mientras suena cada efecto; 5 por defecto; 0 apaga el ducking. No depende del nivel del efecto. */
  db?: number;
  /** Tiempo de la bajada (ms); 10 por defecto. La bajada termina justo cuando arranca el efecto. */
  attackMs?: number;
  /** Tiempo de la subida (ms) después de que el efecto deja de sonar; 250 por defecto. */
  releaseMs?: number;
  /** Amplitud lineal (ya con la ganancia del cue) por encima de la cual el efecto cuenta como sonando; 0,02 por defecto. */
  umbral?: number;
  /** Los cues con ganancia menor a esto no bajan la música; 0,1 por defecto. */
  gainMinimo?: number;
  /** Si es true, la profundidad se multiplica por min(1, gain) del cue; por defecto es la misma para todos. */
  escalaGain?: boolean;
  /** Obsoleto: antes era la razón de compresión del sidechain. Solo se respeta `0` (apaga el ducking). */
  ratio?: number;
}

export interface MezclaOpts {
  fps: number;
  durationFrames: number;
  cues: readonly Cue[];
  /**
   * Tabla opcional de ganancia por efecto (`{ barrido: 0.4, tilde: 0.8 }`): se multiplica con el `gain` de cada cue cuyo
   * `sfx` se llame así (o sea una ruta a un archivo con ese nombre sin la extensión). Sirve para bajar toda una clase de
   * cues sin tocar la lista. Se aplica en `mezclar` (y, por lo tanto, también al ducking: un cue que queda bajo
   * `gainMinimo` ya no baja la música); `planMezcla` recibe los cues ya multiplicados (`aplicarGainPorEfecto`).
   */
  gainPorEfecto?: Readonly<Record<string, number>>;
  sfxDir?: string;
  sr?: number;
  musica?: MusicaOpts;
  /** Pista de locución provista por la persona (wav/mp3 local): va como capa de la mezcla y baja la música mientras habla (ver `voz.ts`). */
  voz?: VozOpts;
  duck?: DuckOpts;
  /** Sonoridad integrada objetivo en LUFS (típicos: -16 para web y redes, -14 plataformas de video, -23 TV). Sin esto no se normaliza. */
  lufs?: number;
  /** Techo de pico verdadero en dBTP del limitador final; -1 por defecto. */
  techoDbtp?: number;
}

export interface PlanMezcla {
  /** Archivos de entrada en orden (-i). La música, si hay, es la entrada 0. */
  inputs: string[];
  /** Genera la señal `outLabel`: 4 canales (música estéreo y efectos estéreo) si hay las dos cosas; si no, 2. */
  filterComplex: string;
  outLabel: string;
  stems: 'ambos' | 'musica' | 'sfx' | 'ninguno';
  totalSamples: number;
  sr: number;
  /** Muestra de salida del cuadro de cada cue (donde cae el ancla: el inicio o el pico del efecto). */
  cueSamples: number[];
  /** Muestra de salida donde empieza cada efecto (menor que `cueSamples` con `ancla: pico`; 0 si se recorta el comienzo). */
  efectoSamples: number[];
  advertencias: string[];
}

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(6).replace(/0+$/, ''));

export function rutaDeEfecto(sfx: string, dir: string): string {
  if (isAbsolute(sfx) || extname(sfx) !== '' || sfx.includes('/')) return sfx;
  return join(dir, `${sfx}.wav`);
}

/** Nombre con el que un cue se busca en la tabla de ganancias: el `sfx` tal cual, o el nombre de archivo sin extensión si es una ruta. */
export function nombreParaGain(sfx: string): string {
  return sfx.includes('/') || isAbsolute(sfx) || extname(sfx) !== '' ? basename(sfx, extname(sfx)) : sfx;
}

/**
 * Multiplica el `gain` de cada cue por el de su efecto en `tabla` (los que no están en la tabla quedan igual). Falla si un
 * valor no es un número >= 0. `sinUsar` (opcional) recibe los nombres de la tabla que no coinciden con ningún cue.
 */
export function aplicarGainPorEfecto(cues: readonly Cue[], tabla: Readonly<Record<string, number>> | undefined, sinUsar?: string[]): Cue[] {
  if (!tabla) return [...cues];
  for (const [n, g] of Object.entries(tabla)) if (!(Number.isFinite(g) && g >= 0)) throw new Error(`Ganancia por efecto inválida para "${n}": ${g} (tiene que ser un número >= 0)`);
  const usados = new Set<string>();
  const out = cues.map((c) => {
    const n = nombreParaGain(c.sfx);
    const g = Object.prototype.hasOwnProperty.call(tabla, n) ? tabla[n] : undefined;
    if (g === undefined) return c;
    usados.add(n);
    return { ...c, gain: (c.gain ?? 1) * g };
  });
  if (sinUsar) for (const n of Object.keys(tabla)) if (!usados.has(n)) sinUsar.push(n);
  return out;
}

export interface InfoCue {
  canales: number;
  /** Muestra (relativa al inicio del efecto) de su pico de energía; solo hace falta con `ancla: pico`. */
  picoSamples: number;
}

/** Valida los cues y deja los que caen dentro del video (con un aviso por cada uno omitido). */
function cuesValidos(o: MezclaOpts, advertencias: string[]): Cue[] {
  const cues: Cue[] = [];
  for (const c of o.cues) {
    if (!Number.isFinite(c.frame) || c.frame < 0) throw new Error(`Cue con frame inválido: ${JSON.stringify(c)}`);
    if (c.gain !== undefined && !(c.gain >= 0)) throw new Error(`Cue con gain inválido: ${JSON.stringify(c)}`);
    if (c.ancla !== undefined && c.ancla !== 'inicio' && c.ancla !== 'pico') throw new Error(`Cue con ancla inválida (tiene que ser "inicio" o "pico"): ${JSON.stringify(c)}`);
    if (c.frame >= o.durationFrames) {
      advertencias.push(`El cue "${c.sfx}" en el cuadro ${c.frame} cae fuera del video (${o.durationFrames} cuadros): se omite`);
      continue;
    }
    cues.push(c);
  }
  return cues;
}

/**
 * Arma las entradas y el filtergraph. `infoPorRuta` (opcional) trae, por ruta de archivo, los canales
 * (un efecto mono se duplica a los dos lados sin perder 3 dB) y el pico de cada efecto (para `ancla: pico`).
 */
export function planMezcla(o: MezclaOpts, infoPorRuta: Readonly<Record<string, InfoCue>> = {}): PlanMezcla {
  const sr = o.sr ?? 48000;
  const totalSamples = Math.round((o.durationFrames / o.fps) * sr);
  const dir = o.sfxDir ?? 'public/sfx';
  const advertencias: string[] = [];
  const cues = cuesValidos(o, advertencias);
  if (cues.length === 0 && !o.musica && !o.voz) throw new Error('No hay nada que mezclar: ni cues ni música ni voz');

  const inputs: string[] = [];
  const f: string[] = [];
  const aEstereo = (ruta: string): string =>
    infoPorRuta[ruta]?.canales === 1 ? `aformat=sample_rates=${sr},pan=stereo|c0=c0|c1=c0` : `aformat=sample_rates=${sr}:channel_layouts=stereo`;
  const fin = `apad=whole_len=${totalSamples},atrim=end_sample=${totalSamples},asetpts=PTS-STARTPTS`;

  let musLabel: string | null = null;
  if (o.musica) {
    const m = o.musica;
    inputs.push(m.archivo);
    const fadeOut = Math.min(m.fadeOutSec ?? 1, totalSamples / sr);
    const partes = [aEstereo(m.archivo)];
    if (m.desdeSec) partes.push(`atrim=start=${num(m.desdeSec)}`, 'asetpts=PTS-STARTPTS');
    partes.push(`volume=${num(m.gain ?? 0.6)}`);
    if (m.fadeInSec) partes.push(`afade=t=in:st=0:d=${num(m.fadeInSec)}`);
    partes.push(fin);
    if (fadeOut > 0) partes.push(`afade=t=out:st=${num(totalSamples / sr - fadeOut)}:d=${num(fadeOut)}`);
    f.push(`[0:a]${partes.join(',')}[mus]`);
    musLabel = 'mus';
  }

  const cueSamples: number[] = [];
  const efectoSamples: number[] = [];
  const etiquetas: string[] = [];
  cues.forEach((c, i) => {
    const idx = inputs.length;
    const ruta = rutaDeEfecto(c.sfx, dir);
    inputs.push(ruta);
    const n = Math.round((c.frame / o.fps) * sr);
    cueSamples.push(n);
    const pico = c.ancla === 'pico' ? (infoPorRuta[ruta]?.picoSamples ?? 0) : 0;
    const inicio = n - pico;
    efectoSamples.push(Math.max(0, inicio));
    const recorte = inicio < 0 ? `atrim=start_sample=${-inicio},asetpts=PTS-STARTPTS,` : '';
    f.push(`[${idx}:a]${aEstereo(ruta)},${recorte}volume=${num(c.gain ?? 1)},adelay=${Math.max(0, inicio)}S:all=1[c${i}]`);
    etiquetas.push(`[c${i}]`);
  });

  let sfxLabel: string | null = null;
  if (etiquetas.length > 0) {
    const bus = etiquetas.length === 1 ? `${etiquetas[0]}anull` : `${etiquetas.join('')}amix=inputs=${etiquetas.length}:normalize=0:duration=longest`;
    f.push(`${bus},${fin}[sfx]`);
    sfxLabel = 'sfx';
  }

  let stems: PlanMezcla['stems'];
  if (!musLabel && !sfxLabel) {
    // Solo voz: no hay nada que pedirle a ffmpeg; la capa de voz se arma en memoria.
    return { inputs, filterComplex: '', outLabel: '', stems: 'ninguno', totalSamples, sr, cueSamples, efectoSamples, advertencias };
  }
  if (musLabel && sfxLabel) {
    f.push(`[${musLabel}][${sfxLabel}]amerge=inputs=2[out]`);
    stems = 'ambos';
  } else {
    f.push(`[${(musLabel ?? sfxLabel)!}]anull[out]`);
    stems = musLabel ? 'musica' : 'sfx';
  }
  return { inputs, filterComplex: f.join(';'), outLabel: 'out', stems, totalSamples, sr, cueSamples, efectoSamples, advertencias };
}

/**
 * Ventanas de ducking de cada cue: desde donde arranca el efecto hasta donde deja de superar el
 * umbral. `activoPorCue[i]` es la duración activa (muestras) del cue i, ya con su ganancia. Los cues
 * con ganancia menor a `gainMinimo` no bajan la música.
 */
export function ventanasDeDucking(cues: readonly Cue[], plan: Pick<PlanMezcla, 'efectoSamples'>, activoPorCue: readonly number[], d: DuckOpts = {}): VentanaDuck[] {
  const db = d.ratio === 0 ? 0 : (d.db ?? 5);
  const minimo = d.gainMinimo ?? 0.1;
  const out: VentanaDuck[] = [];
  if (db <= 0) return out;
  cues.forEach((c, i) => {
    const g = c.gain ?? 1;
    if (g < minimo || activoPorCue[i] <= 0) return;
    const ini = plan.efectoSamples[i];
    out.push({ iniSample: ini, finSample: ini + activoPorCue[i], profundidadDb: db * (d.escalaGain ? Math.min(1, g) : 1) });
  });
  return out;
}

export interface InfoMezcla {
  /** Sonoridad integrada (LUFS) de la mezcla antes de normalizar ni limitar; null si es silencio. */
  lufsAntes: number | null;
  /** Ganancia (dB) aplicada para llegar al objetivo `--lufs`; 0 si no se pidió. */
  gananciaLufsDb: number;
  /** Reducción máxima del limitador (dB); 0 si la mezcla ya cabía bajo el techo. */
  reduccionLimitadorDb: number;
  /** Sonoridad integrada (LUFS) del archivo final. */
  lufsFinal: number | null;
  /** Pico verdadero (dBTP, sobremuestreo x8) del archivo final. */
  picoVerdaderoDbtp: number;
  /** Muestras de cada ventana de ducking (para verificar). */
  ventanasDuck: VentanaDuck[];
  /** Tramos (muestras de salida) donde se detectó voz; vacío sin `voz`. La música baja `voz.duckDb` mientras duran (más la subida). */
  ventanasVoz: VentanaDuck[];
  /** Los mismos tramos en segundos, para cruzar con los subtítulos y los cortes de escena (`locucion` en la CLI). */
  tramosVozSec: Array<{ desde: number; hasta: number }>;
}

/** Falla de entrada, nombrando el cue, si falta algún archivo. */
export function verificarArchivos(o: MezclaOpts): void {
  const dir = o.sfxDir ?? 'public/sfx';
  if (o.musica && !existsSync(resolve(o.musica.archivo))) throw new Error(`No existe el archivo de música: ${o.musica.archivo}`);
  if (o.voz && !existsSync(resolve(o.voz.archivo))) throw new Error(`No existe el archivo de voz: ${o.voz.archivo}. La voz la aporta la persona (wav o mp3 local, nunca al repo).`);
  o.cues.forEach((c, i) => {
    if (!(c.frame >= o.durationFrames)) {
      const ruta = rutaDeEfecto(c.sfx, dir);
      if (!existsSync(resolve(ruta))) {
        throw new Error(`El cue ${i + 1} (cuadro ${c.frame}, sfx "${c.sfx}") apunta a un archivo que no existe: ${ruta}. Generá el set con "npm run audio -- efectos --out <carpeta>" o pasá la ruta completa.`);
      }
    }
  });
}

/** Renderiza la mezcla a `salida` (el formato lo da la extensión). */
export async function mezclar(opts: MezclaOpts & { salida: string }): Promise<PlanMezcla & { info: InfoMezcla }> {
  const sinUsar: string[] = [];
  const o = { ...opts, cues: aplicarGainPorEfecto(opts.cues, opts.gainPorEfecto, sinUsar) };
  verificarArchivos(o);
  const sr = o.sr ?? 48000;
  const dir = o.sfxDir ?? 'public/sfx';
  const avisos: string[] = [];
  // Una pasada por cada archivo: canales (ffprobe) y, para los efectos, señal mono para medir pico y duración.
  const info: Record<string, InfoCue> = {};
  const monos = new Map<string, Float32Array>();
  const rutas = new Set<string>();
  if (o.musica) rutas.add(o.musica.archivo);
  for (const c of o.cues) if (!(c.frame >= o.durationFrames)) rutas.add(rutaDeEfecto(c.sfx, dir));
  for (const r of rutas) {
    const s = sondear(r);
    info[r] = { canales: s?.canales ?? 2, picoSamples: 0 };
    const av = avisoMp3SinEtiqueta(r);
    if (av) avisos.push(av);
  }
  const efectos = new Set([...rutas].filter((r) => r !== o.musica?.archivo));
  for (const r of efectos) {
    const m = await decodificar(r, { sr, canales: 1 });
    monos.set(r, m);
    info[r].picoSamples = analizarEfecto(m, sr).picoSamples;
  }
  const plan = planMezcla(o, info);
  plan.advertencias.push(...avisos);
  if (sinUsar.length > 0) plan.advertencias.push(`--gain: ningún cue usa ${sinUsar.map((n) => `"${n}"`).join(', ')} (se compara con el nombre del sfx tal cual, por ejemplo barrido-aire y no barrido)`);
  const cues = o.cues.filter((c) => !(c.frame >= o.durationFrames));
  const nCan = plan.stems === 'ambos' ? 4 : 2;

  let todo: Float32Array<ArrayBufferLike> = new Float32Array(0);
  if (plan.stems !== 'ninguno') {
    const args = ['-y'];
    // Rutas absolutas: una que empiece con "-" ffmpeg la leería como opción.
    for (const i of plan.inputs) args.push('-i', resolve(i));
    args.push('-filter_complex', plan.filterComplex, '-map', `[${plan.outLabel}]`, '-f', 'f32le', '-ac', String(nCan), 'pipe:1');
    const buf = await runFfmpeg(args);
    todo = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength - (buf.byteLength % 4)));
  }
  const n = plan.stems === 'ninguno' ? plan.totalSamples : Math.floor(todo.length / nCan);
  let mus: Float32Array | null = null;
  let sfx: Float32Array | null = null;
  if (plan.stems === 'ninguno') {
    // solo voz
  } else if (plan.stems === 'ambos') {
    mus = new Float32Array(n * 2);
    sfx = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      mus[2 * i] = todo[4 * i];
      mus[2 * i + 1] = todo[4 * i + 1];
      sfx[2 * i] = todo[4 * i + 2];
      sfx[2 * i + 1] = todo[4 * i + 3];
    }
  } else if (plan.stems === 'musica') mus = todo;
  else sfx = todo;

  // Ducking de la música bajo cada efecto: profundidad fija, atack y release previsibles.
  const d = o.duck ?? {};
  let ventanas: VentanaDuck[] = [];
  let curvaSfx: Float32Array | null = null;
  if (mus && sfx) {
    const activo = cues.map((c) => analizarEfecto(monos.get(rutaDeEfecto(c.sfx, dir))!, sr, c.gain ?? 1, d.umbral ?? 0.02).activoSamples);
    ventanas = ventanasDeDucking(cues, plan, activo, d);
    if (ventanas.length > 0) curvaSfx = curvaDeDucking(ventanas, plan.totalSamples, sr, d.attackMs ?? 10, d.releaseMs ?? 250);
  }

  // Locución: capa propia (estéreo, en su lugar del video) y, si hay música, ducking por la voz. Con efectos y voz a la vez manda el más profundo (no se suman).
  let voz: Float32Array | null = null;
  let ventanasVoz: VentanaDuck[] = [];
  if (o.voz) {
    const crudo = await decodificar(o.voz.archivo, { sr, canales: 2 });
    const av = avisoMp3SinEtiqueta(o.voz.archivo);
    if (av) plan.advertencias.push(av);
    const colocada = colocarVoz(crudo, sr, n, o.voz);
    voz = colocada.estereo;
    plan.advertencias.push(...colocada.avisos);
    ventanasVoz = colocada.ventanas;
    if (mus && ventanasVoz.length > 0) {
      const curvaVoz = curvaDeDucking(ventanasVoz, plan.totalSamples, sr, o.voz.duckAtaqueMs ?? 60, o.voz.duckReleaseMs ?? 450);
      if (curvaSfx) for (let i = 0; i < curvaVoz.length; i++) curvaVoz[i] = Math.min(curvaVoz[i]!, curvaSfx[i]!);
      curvaSfx = curvaVoz;
    }
  }
  if (mus && curvaSfx) aplicarCurva(mus, curvaSfx, 2);
  const mix = new Float32Array(n * 2);
  for (let i = 0; i < mix.length; i++) mix[i] = (mus?.[i] ?? 0) + (sfx?.[i] ?? 0) + (voz?.[i] ?? 0);

  const lufsAntes = sonoridadIntegrada(mix, sr, 2);
  let gananciaLufsDb = 0;
  if (o.lufs !== undefined && Number.isFinite(lufsAntes)) {
    gananciaLufsDb = o.lufs - lufsAntes;
    const g = Math.pow(10, gananciaLufsDb / 20);
    for (let i = 0; i < mix.length; i++) mix[i] *= g;
  } else if (o.lufs !== undefined) plan.advertencias.push('La mezcla está en silencio: no se puede normalizar la sonoridad.');
  // Limitador final de pico verdadero, sin retardo (fase cero): nada se corre ni una muestra.
  const lim = limitar(mix, 2, sr, { techoDbtp: o.techoDbtp });
  const lufsFinal = sonoridadIntegrada(mix, sr, 2);
  if (o.lufs !== undefined && Number.isFinite(lufsFinal) && lufsFinal < o.lufs - 0.5) {
    plan.advertencias.push(`El limitador (techo ${o.techoDbtp ?? -1} dBTP) frenó la normalización: la mezcla quedó en ${lufsFinal.toFixed(1)} LUFS en vez de ${o.lufs}. Bajá el objetivo o los picos de los efectos.`);
  }
  await codificar(mix, { sr, canales: 2, salida: o.salida, bits: 16 });
  return {
    ...plan,
    info: {
      lufsAntes: Number.isFinite(lufsAntes) ? Math.round(lufsAntes * 10) / 10 : null,
      gananciaLufsDb: Math.round(gananciaLufsDb * 100) / 100,
      reduccionLimitadorDb: lim.reduccionMaxDb,
      lufsFinal: Number.isFinite(lufsFinal) ? Math.round(lufsFinal * 10) / 10 : null,
      picoVerdaderoDbtp: Math.round(picoVerdaderoDb(mix, 2, 8) * 100) / 100,
      ventanasDuck: ventanas,
      ventanasVoz,
      tramosVozSec: ventanasVoz.map((v) => ({ desde: Math.round((v.iniSample / sr) * 1000) / 1000, hasta: Math.round((v.finSample / sr) * 1000) / 1000 })),
    },
  };
}
