// Informe de mezcla: para quien no puede oír. Arma las capas de la mezcla (como `mezclar`, sin escribir el wav) y mide lo que el oído notaría:
// qué pista suena cuándo, cuánto sobresale cada efecto sobre la música en su instante, dónde hay silencios y solapamientos y dónde hay voz.
// El análisis es puro sobre PCM en memoria; `informar` solo decodifica archivos (ffmpeg) para armar las capas.
import { decodificar } from './ffmpeg';
import { construirCapas, rutaDeEfecto, type Capas, type MezclaOpts } from './mezcla';
import { nivelesPorBloque, silenciosDe } from './silencios';
import { UMBRAL_VOZ_PROBABLE, vozProbable } from './voz';

/** Margen (dB) del efecto sobre la música en su instante, desde el cual el efecto "sobresale" con claridad. */
export const MARGEN_SOBRESALE_DB = 6;
/** Entre 0 y `MARGEN_SOBRESALE_DB` el efecto se oye pero compite con la música ("justo"). */
export const MARGEN_JUSTO_DB = 0;
/** Entre este margen y 0 el efecto queda casi tapado; por debajo, tapado. */
export const MARGEN_TAPADO_DB = -6;
/** Una música por debajo de este nivel (dBFS, RMS) en el instante del efecto cuenta como "no hay música". */
export const MUSICA_AUSENTE_DB = -60;
/** Un efecto por debajo de este nivel (dBFS, RMS) no se oye. */
export const EFECTO_INAUDIBLE_DB = -55;
/** Nivel (dBFS, RMS en bloques de 20 ms) desde el cual una pista "suena" para decidir dónde empieza, dónde termina y si se solapa con otra. */
export const UMBRAL_ACTIVO_DB = -50;
/** Un solapamiento más corto que esto (s) no se informa. */
export const SOLAPE_MIN_SEC = 0.1;
/** Largo (s) de la ventana en que se mide cada efecto (la más fuerte del efecto). */
export const VENTANA_EFECTO_SEC = 0.25;

export type EstadoCue = 'sobresale' | 'justo' | 'casi-tapado' | 'tapado' | 'libre' | 'inaudible';

export interface PistaExtra {
  nombre: string;
  archivo: string;
  /** Segundo del video en que entra (0 por defecto). */
  enSec?: number;
  /** Segundo del archivo desde el que arranca. */
  desdeSec?: number;
  gain?: number;
}

export interface PropioDeclarado {
  escena: string;
  desdeSec: number;
  hastaSec: number;
}

export interface InformeOpts extends MezclaOpts {
  /** Otras pistas de audio (por ejemplo el audio propio de una escena exportado a un archivo): no entran a la mezcla, solo se analizan. */
  pistas?: PistaExtra[];
  /** Tramos de audio propio declarados por las escenas (`SceneInfo.audioPropio`). */
  propios?: PropioDeclarado[];
  /** Escena de la que salió cada cue (mismo orden que `cues`), para nombrarla en el informe. */
  escenaDeCue?: string[];
  /** Silencios más cortos que esto (s) no se informan; 1 por defecto. */
  silencioMinSec?: number;
  /** Nombres de pistas (`musica`, `pistas[].nombre`) donde la voz está pedida: no avisa. La pista `--voz` siempre es esperada. */
  vozEsperada?: string[];
}

export interface InfoPista {
  nombre: string;
  archivo: string;
  /** Primer y último instante (s) en que suena (sobre `UMBRAL_ACTIVO_DB`), dentro del video; null si no suena. */
  desdeSec: number | null;
  hastaSec: number | null;
  /** Nivel RMS (dBFS) medio de los tramos que suenan y pico (dBFS de muestra). */
  nivelDb: number | null;
  picoDb: number | null;
}

export interface InfoCueInforme {
  n: number;
  frame: number;
  tSec: number;
  sfx: string;
  gain: number;
  escena?: string;
  /** Nivel (dBFS RMS) del efecto, ya con su ganancia, en su ventana más fuerte. */
  efectoDb: number | null;
  /** Nivel (dBFS RMS) de la música en esa ventana, con el ducking aplicado; null si no hay música. */
  musicaDb: number | null;
  /** efectoDb - musicaDb; null sin música (o sin efecto audible). */
  margenDb: number | null;
  /** Lo mismo pero con la música sin ducking (el peor caso si el ducking se apaga). */
  margenSinDuckDb: number | null;
  estado: EstadoCue;
  pisaVoz: boolean;
  enAudioPropio: boolean;
}

export type TipoSolape = 'musica-audio-propio' | 'voz-audio-propio' | 'cue-audio-propio' | 'pistas';

export interface Solapamiento {
  tipo: TipoSolape;
  a: string;
  b: string;
  desdeSec: number;
  hastaSec: number;
  detalle: string;
}

export interface SilencioInformado {
  /** Pista (o `mezcla` si no suena nada). */
  pista: string;
  desdeSec: number;
  hastaSec: number;
  ubicacion: 'inicio' | 'interno' | 'final';
  /** Si coincide con un tramo de audio propio: la escena. */
  motivo?: string;
}

export interface VozEncontrada {
  pista: string;
  desdeSec: number;
  hastaSec: number;
  puntaje: number;
  esperada: boolean;
}

export type TipoEvento = 'pista-entra' | 'pista-sale' | 'cue' | 'audio-propio-entra' | 'audio-propio-sale' | 'voz';

export interface EventoDeTiempo {
  tSec: number;
  frame: number;
  tipo: TipoEvento;
  texto: string;
}

export interface Informe {
  fps: number;
  durationFrames: number;
  duracionSec: number;
  pistas: InfoPista[];
  propios: PropioDeclarado[];
  cues: InfoCueInforme[];
  silencios: SilencioInformado[];
  solapamientos: Solapamiento[];
  voz: VozEncontrada[];
  lineaDeTiempo: EventoDeTiempo[];
  avisos: string[];
  resumen: { cues: number; porEstado: Record<EstadoCue, number>; silencios: number; solapamientos: number; vozInesperada: number };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const db = (p: number) => (p > 0 ? 10 * Math.log10(p) : -Infinity);

/** Promedio de los dos canales de un estéreo entrelazado. */
export function aMono(e: Float32Array): Float32Array {
  const n = Math.floor(e.length / 2);
  const m = new Float32Array(n);
  for (let i = 0; i < n; i++) m[i] = 0.5 * (e[2 * i]! + e[2 * i + 1]!);
  return m;
}

/** Potencia media (cuadrado) de `x[i0, i0+len)`, con los dos canales de un estéreo entrelazado promediados. */
function potencia(e: Float32Array, i0: number, len: number): number {
  const fin = Math.min(Math.floor(e.length / 2), i0 + len);
  let s = 0;
  for (let i = Math.max(0, i0); i < fin; i++) s += 0.5 * (e[2 * i]! * e[2 * i]! + e[2 * i + 1]! * e[2 * i + 1]!);
  return fin > i0 ? s / (fin - Math.max(0, i0)) : 0;
}

/** Intervalos (s) donde la señal suena (RMS en bloques de 20 ms sobre `umbralDb`); une los que distan menos de `unirSec` y descarta los de menos de `minSec`. */
export function intervalosActivos(x: Float32Array, sr: number, umbralDb = UMBRAL_ACTIVO_DB, unirSec = 0.25, minSec = 0.1): Array<{ desde: number; hasta: number }> {
  const { db: niv, bloque } = nivelesPorBloque(x, sr, 20);
  const out: Array<{ desde: number; hasta: number }> = [];
  let ini = -1;
  let ult = -1;
  const t = (b: number) => (b * bloque) / sr;
  for (let b = 0; b < niv.length; b++) {
    if (niv[b]! < umbralDb) continue;
    if (ini < 0) ini = b;
    else if (t(b - ult - 1) > unirSec) {
      out.push({ desde: t(ini), hasta: t(ult + 1) });
      ini = b;
    }
    ult = b;
  }
  if (ini >= 0) out.push({ desde: t(ini), hasta: Math.min(x.length / sr, t(ult + 1)) });
  return out.filter((q) => q.hasta - q.desde >= minSec);
}

/** Estado de un efecto según su margen sobre la música (ver los umbrales exportados). */
export function estadoDeMargen(efectoDb: number | null, musicaDb: number | null): EstadoCue {
  if (efectoDb === null || efectoDb < EFECTO_INAUDIBLE_DB) return 'inaudible';
  if (musicaDb === null || musicaDb < MUSICA_AUSENTE_DB) return 'libre';
  const m = efectoDb - musicaDb;
  if (m >= MARGEN_SOBRESALE_DB) return 'sobresale';
  if (m >= MARGEN_JUSTO_DB) return 'justo';
  if (m >= MARGEN_TAPADO_DB) return 'casi-tapado';
  return 'tapado';
}

/** Ventana de `len` muestras de más energía de un efecto mono (paso de 25 ms): devuelve su inicio y su nivel RMS (dBFS) ya con `gain`. */
function ventanaFuerte(x: Float32Array, sr: number, gain: number, lenSec: number): { ini: number; len: number; db: number } {
  const len = Math.max(1, Math.min(x.length, Math.round(lenSec * sr)));
  const paso = Math.max(1, Math.round(0.025 * sr));
  let mejor = { ini: 0, e: -1 };
  for (let i = 0; i + len <= Math.max(x.length, len); i += paso) {
    let e = 0;
    for (let j = i; j < Math.min(x.length, i + len); j++) e += x[j]! * x[j]!;
    if (e > mejor.e) mejor = { ini: i, e };
  }
  return { ini: mejor.ini, len, db: db((mejor.e / len) * gain * gain) };
}

/** Decima por un factor entero (promedio de grupos) para correr la detección de voz a ~16 kHz. */
function aBaja(x: Float32Array, sr: number): { x: Float32Array; sr: number } {
  const f = Math.max(1, Math.floor(sr / 16000));
  if (f === 1) return { x, sr };
  const n = Math.floor(x.length / f);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < f; k++) s += x[i * f + k]!;
    y[i] = s / f;
  }
  return { x: y, sr: sr / f };
}

function interseccion(a: { desde: number; hasta: number }, b: { desde: number; hasta: number }): { desde: number; hasta: number } | null {
  const d = Math.max(a.desde, b.desde);
  const h = Math.min(a.hasta, b.hasta);
  return h > d ? { desde: d, hasta: h } : null;
}

export interface CapasParaInforme {
  capas: Capas | null;
  extras: Array<{ nombre: string; mono: Float32Array }>;
}

/** Análisis puro sobre las capas ya armadas (probable en pruebas con PCM sintético). */
export function analizarCapas(o: InformeOpts, capas: Capas | null, extras: CapasParaInforme['extras']): Informe {
  const fps = o.fps;
  const sr = capas?.sr ?? o.sr ?? 48000;
  const duracionSec = o.durationFrames / fps;
  const avisos: string[] = [...(capas?.plan.advertencias ?? [])];
  const propios = [...(o.propios ?? [])].sort((a, b) => a.desdeSec - b.desdeSec);
  const esperada = new Set(o.vozEsperada ?? []);
  const silencioMin = o.silencioMinSec ?? 1;

  // --- pistas (música, voz, extras): dónde suenan y a qué nivel
  const pistas: InfoPista[] = [];
  const activos = new Map<string, Array<{ desde: number; hasta: number }>>();
  const monos = new Map<string, Float32Array>();
  const describir = (nombre: string, archivo: string, mono: Float32Array) => {
    const act = intervalosActivos(mono, sr);
    activos.set(nombre, act);
    monos.set(nombre, mono);
    let suma = 0;
    let cuenta = 0;
    let pico = 0;
    for (const t of act) {
      const i0 = Math.round(t.desde * sr);
      const i1 = Math.min(mono.length, Math.round(t.hasta * sr));
      for (let i = i0; i < i1; i++) {
        suma += mono[i]! * mono[i]!;
        cuenta++;
      }
    }
    for (let i = 0; i < mono.length; i++) pico = Math.max(pico, Math.abs(mono[i]!));
    pistas.push({
      nombre,
      archivo,
      desdeSec: act.length ? r3(act[0]!.desde) : null,
      hastaSec: act.length ? r3(act[act.length - 1]!.hasta) : null,
      nivelDb: cuenta ? r2(db(suma / cuenta)) : null,
      picoDb: pico > 0 ? r2(20 * Math.log10(pico)) : null,
    });
  };
  if (capas?.musSinDuck && o.musica) describir('musica', o.musica.archivo, aMono(capas.musSinDuck));
  if (capas?.voz && o.voz) describir('voz', o.voz.archivo, aMono(capas.voz));
  for (const e of extras) describir(e.nombre, o.pistas?.find((p) => p.nombre === e.nombre)?.archivo ?? e.nombre, e.mono);
  for (const p of pistas) if (p.desdeSec === null) avisos.push(`La pista "${p.nombre}" no suena en ningún momento del video (nada sobre ${UMBRAL_ACTIVO_DB} dBFS).`);

  // --- cues: margen sobre la música
  const cues: InfoCueInforme[] = [];
  const tramosVoz = capas?.ventanasVoz.map((v) => ({ desde: v.iniSample / sr, hasta: v.finSample / sr })) ?? [];
  const idxValidos = o.cues.map((_, i) => i).filter((i) => !(o.cues[i]!.frame >= o.durationFrames));
  const nombreEscena = (i: number) => o.escenaDeCue?.[idxValidos[i]!];
  if (capas) {
    const validos = capas.cues;
    validos.forEach((c, i) => {
      const ruta = rutaDeEfecto(c.sfx, capas.sfxDir);
      const mono = capas.monos.get(ruta);
      const ini = capas.plan.efectoSamples[i]!;
      let efectoDb: number | null = null;
      let musicaDb: number | null = null;
      let sinDuckDb: number | null = null;
      let ventIni = ini;
      let ventLen = Math.round(VENTANA_EFECTO_SEC * sr);
      if (mono) {
        const v = ventanaFuerte(mono, sr, c.gain ?? 1, VENTANA_EFECTO_SEC);
        ventIni = ini + v.ini;
        ventLen = v.len;
        efectoDb = Number.isFinite(v.db) ? r2(v.db) : null;
      }
      if (capas.mus) {
        const p = potencia(capas.mus, ventIni, ventLen);
        musicaDb = p > 0 ? r2(db(p)) : null;
        const q = potencia(capas.musSinDuck!, ventIni, ventLen);
        sinDuckDb = q > 0 ? r2(db(q)) : null;
      }
      const estado = estadoDeMargen(efectoDb, musicaDb);
      const t = c.frame / fps;
      const dentro = propios.find((p) => t >= p.desdeSec && t < p.hastaSec);
      cues.push({
        n: i + 1, frame: c.frame, tSec: r3(t), sfx: c.sfx, gain: r2(c.gain ?? 1), ...(nombreEscena(i) ? { escena: nombreEscena(i) } : {}),
        efectoDb, musicaDb, margenDb: efectoDb !== null && musicaDb !== null && estado !== 'libre' ? r2(efectoDb - musicaDb) : null,
        margenSinDuckDb: efectoDb !== null && sinDuckDb !== null && sinDuckDb >= MUSICA_AUSENTE_DB ? r2(efectoDb - sinDuckDb) : null,
        estado, pisaVoz: tramosVoz.some((v) => ventIni / sr < v.hasta && (ventIni + ventLen) / sr > v.desde), enAudioPropio: dentro !== undefined,
      });
    });
  }

  // --- solapamientos
  const solapamientos: Solapamiento[] = [];
  const agregarSolape = (tipo: TipoSolape, a: string, b: string, x: { desde: number; hasta: number }, detalle: string) => {
    if (x.hasta - x.desde >= SOLAPE_MIN_SEC) solapamientos.push({ tipo, a, b, desdeSec: r3(x.desde), hastaSec: r3(x.hasta), detalle });
  };
  for (const p of propios) {
    const pr = { desde: p.desdeSec, hasta: p.hastaSec };
    for (const [nombre, act] of activos) {
      const tipo: TipoSolape = nombre === 'musica' ? 'musica-audio-propio' : nombre === 'voz' ? 'voz-audio-propio' : 'pistas';
      if (tipo === 'pistas') continue; // las pistas extra se cruzan entre sí y con la música más abajo
      for (const t of act) {
        const x = interseccion(t, pr);
        if (x) agregarSolape(tipo, nombre, `audio propio de "${p.escena}"`, x, nombre === 'musica' ? `la música suena ${r2(x.hasta - x.desde)} s dentro de una escena con audio propio: terminala o bajala antes (mezcla --video lo hace solo)` : `la voz suena ${r2(x.hasta - x.desde)} s sobre el audio propio de la escena`);
      }
    }
  }
  for (const c of cues) {
    if (c.enAudioPropio) {
      const p = propios.find((q) => c.tSec >= q.desdeSec && c.tSec < q.hastaSec)!;
      solapamientos.push({ tipo: 'cue-audio-propio', a: `cue ${c.n} (${c.sfx}, cuadro ${c.frame})`, b: `audio propio de "${p.escena}"`, desdeSec: c.tSec, hastaSec: c.tSec, detalle: 'un efecto cae dentro de una escena con audio propio' });
    }
  }
  const nombres = [...activos.keys()];
  for (let i = 0; i < nombres.length; i++) {
    for (let j = i + 1; j < nombres.length; j++) {
      const a = nombres[i]!;
      const b = nombres[j]!;
      if ((a === 'musica' && b === 'voz') || (a === 'voz' && b === 'musica')) continue; // la voz sobre la música es lo normal: la música baja (ducking)
      for (const ta of activos.get(a)!) for (const tb of activos.get(b)!) {
        const x = interseccion(ta, tb);
        if (x) agregarSolape('pistas', a, b, x, `"${a}" y "${b}" suenan a la vez durante ${r2(x.hasta - x.desde)} s`);
      }
    }
  }
  solapamientos.sort((p, q) => p.desdeSec - q.desdeSec || p.a.localeCompare(q.a));

  // --- silencios: de cada pista y de toda la mezcla
  const silencios: SilencioInformado[] = [];
  const motivoDe = (d: number, h: number): string | undefined => {
    const p = propios.find((q) => (interseccion({ desde: d, hasta: h }, { desde: q.desdeSec, hasta: q.hastaSec })?.hasta ?? 0) - (interseccion({ desde: d, hasta: h }, { desde: q.desdeSec, hasta: q.hastaSec })?.desde ?? 0) > 0.5 * (h - d));
    return p ? `audio propio de "${p.escena}"` : undefined;
  };
  const registrar = (pista: string, x: Float32Array) => {
    for (const t of silenciosDe(x, sr, { minSec: silencioMin })) {
      const ub: SilencioInformado['ubicacion'] = t.desde < 0.01 ? 'inicio' : t.hasta > duracionSec - 0.01 ? 'final' : 'interno';
      const m = motivoDe(t.desde, t.hasta);
      silencios.push({ pista, desdeSec: r3(t.desde), hastaSec: r3(t.hasta), ubicacion: ub, ...(m ? { motivo: m } : {}) });
    }
  };
  for (const [nombre, mono] of monos) if (nombre !== 'voz') registrar(nombre, mono);
  if (capas) {
    const mix = new Float32Array(capas.n);
    for (let i = 0; i < capas.n; i++) mix[i] = 0.5 * (((capas.mus?.[2 * i] ?? 0) + (capas.sfx?.[2 * i] ?? 0) + (capas.voz?.[2 * i] ?? 0)) + ((capas.mus?.[2 * i + 1] ?? 0) + (capas.sfx?.[2 * i + 1] ?? 0) + (capas.voz?.[2 * i + 1] ?? 0)));
    registrar('mezcla', mix);
  }
  silencios.sort((p, q) => p.desdeSec - q.desdeSec || p.pista.localeCompare(q.pista));

  // --- voz probable en cualquier pista
  const voz: VozEncontrada[] = [];
  const buscar = (pista: string, x: Float32Array, esp: boolean) => {
    const b = aBaja(x, sr);
    for (const t of vozProbable(b.x, b.sr)) voz.push({ pista, desdeSec: r3(t.desde), hastaSec: r3(t.hasta), puntaje: t.puntaje, esperada: esp });
  };
  for (const [nombre, mono] of monos) {
    if (nombre === 'voz') continue; // la pista pedida: sus tramos ya salen de la mezcla (ventanasVoz)
    buscar(nombre, mono, esperada.has(nombre));
  }
  if (capas) {
    const vistos = new Set<string>();
    for (const c of capas.cues) {
      const ruta = rutaDeEfecto(c.sfx, capas.sfxDir);
      const m = capas.monos.get(ruta);
      if (!m || vistos.has(ruta) || m.length / sr < 1) continue;
      vistos.add(ruta);
      buscar(`efecto ${c.sfx}`, m, esperada.has(c.sfx));
    }
  }
  if (capas?.voz) for (const t of tramosVoz) voz.push({ pista: 'voz', desdeSec: r3(t.desde), hastaSec: r3(t.hasta), puntaje: 1, esperada: true });
  voz.sort((p, q) => p.desdeSec - q.desdeSec || p.pista.localeCompare(q.pista));
  const inesperada = voz.filter((v) => !v.esperada);
  for (const v of inesperada) avisos.push(`Hay voz probable en "${v.pista}" de ${r2(v.desdeSec)} s a ${r2(v.hastaSec)} s (puntaje ${v.puntaje}) y no se pidió voz ahí. Es una heurística: escuchalo o descartalo con --voz-esperada ${v.pista.replace(/^efecto /, '')}.`);

  // --- avisos de cues
  for (const c of cues) {
    if (c.estado === 'tapado') avisos.push(`Cue ${c.n} (${c.sfx}, cuadro ${c.frame}, ${r2(c.tSec)} s): queda TAPADO por la música (${c.margenDb} dB). Subí su gain, bajá la música (--musica-bajo-efectos) o subí --duck-db.`);
    else if (c.estado === 'casi-tapado') avisos.push(`Cue ${c.n} (${c.sfx}, cuadro ${c.frame}, ${r2(c.tSec)} s): casi tapado por la música (${c.margenDb} dB).`);
    else if (c.estado === 'inaudible') avisos.push(`Cue ${c.n} (${c.sfx}, cuadro ${c.frame}): el efecto es inaudible (${c.efectoDb ?? 'sin señal'} dBFS); revisá su gain.`);
    if (c.pisaVoz) avisos.push(`Cue ${c.n} (${c.sfx}, cuadro ${c.frame}) cae sobre la voz.`);
  }
  for (const s of solapamientos) avisos.push(`Solapamiento: ${s.a} con ${s.b} (${r2(s.desdeSec)} a ${r2(s.hastaSec)} s): ${s.detalle}.`);
  for (const s of silencios) {
    if (s.pista === 'mezcla' && !s.motivo) avisos.push(`Silencio de toda la mezcla de ${r2(s.desdeSec)} s a ${r2(s.hastaSec)} s (${s.ubicacion}).`);
    else if (s.pista === 'musica' && s.ubicacion === 'final' && !s.motivo) avisos.push(`La música termina ${r2(s.hastaSec - s.desdeSec)} s antes del final del video (silencio desde ${r2(s.desdeSec)} s).`);
  }

  // --- línea de tiempo
  const linea: EventoDeTiempo[] = [];
  const ev = (tSec: number, tipo: TipoEvento, texto: string) => linea.push({ tSec: r3(tSec), frame: Math.round(tSec * fps), tipo, texto });
  for (const p of pistas) if (p.desdeSec !== null) {
    ev(p.desdeSec, 'pista-entra', `entra ${p.nombre}${p.nivelDb !== null ? ` (${p.nivelDb} dBFS)` : ''}`);
    ev(p.hastaSec!, 'pista-sale', `sale ${p.nombre}`);
  }
  for (const p of propios) {
    ev(p.desdeSec, 'audio-propio-entra', `entra el audio propio de "${p.escena}"`);
    ev(p.hastaSec, 'audio-propio-sale', `sale el audio propio de "${p.escena}"`);
  }
  for (const c of cues) ev(c.tSec, 'cue', `cue ${c.n} ${c.sfx}${c.escena ? ` [${c.escena}]` : ''}: ${c.estado}${c.margenDb !== null ? ` (${c.margenDb > 0 ? '+' : ''}${c.margenDb} dB)` : ''}`);
  for (const v of inesperada) ev(v.desdeSec, 'voz', `voz probable en ${v.pista} hasta ${r2(v.hastaSec)} s`);
  linea.sort((p, q) => p.tSec - q.tSec);

  const porEstado: Record<EstadoCue, number> = { sobresale: 0, justo: 0, 'casi-tapado': 0, tapado: 0, libre: 0, inaudible: 0 };
  for (const c of cues) porEstado[c.estado]++;
  return {
    fps, durationFrames: o.durationFrames, duracionSec: r3(duracionSec), pistas, propios, cues, silencios, solapamientos, voz, lineaDeTiempo: linea, avisos,
    resumen: { cues: cues.length, porEstado, silencios: silencios.length, solapamientos: solapamientos.length, vozInesperada: inesperada.length },
  };
}

/** Arma las capas (decodifica los archivos) y analiza. */
export async function informar(o: InformeOpts): Promise<Informe> {
  const sr = o.sr ?? 48000;
  const hayMezcla = o.cues.length > 0 || !!o.musica || !!o.voz;
  const capas = hayMezcla ? await construirCapas({ ...o, sr }) : null;
  const n = capas?.n ?? Math.round((o.durationFrames / o.fps) * sr);
  const extras: CapasParaInforme['extras'] = [];
  for (const p of o.pistas ?? []) {
    const crudo = await decodificar(p.archivo, { sr, canales: 2 });
    const desde = Math.round((p.desdeSec ?? 0) * sr);
    const en = Math.round((p.enSec ?? 0) * sr);
    const g = p.gain ?? 1;
    const mono = new Float32Array(n);
    const total = Math.floor(crudo.length / 2) - desde;
    for (let i = 0; i < Math.max(0, Math.min(total, n - en)); i++) mono[en + i] = 0.5 * (crudo[2 * (desde + i)]! + crudo[2 * (desde + i) + 1]!) * g;
    extras.push({ nombre: p.nombre, mono });
  }
  return analizarCapas({ ...o, sr }, capas, extras);
}

const t2 = (s: number) => `${r2(s).toFixed(2)} s`;

/** Texto del informe, en español, para leer en la terminal. */
export function formatearInforme(i: Informe): string {
  const L: string[] = [];
  L.push(`Informe de mezcla: ${i.durationFrames} cuadros a ${i.fps} fps (${t2(i.duracionSec)})`);
  L.push('');
  L.push('Pistas');
  if (i.pistas.length === 0) L.push('  (ninguna con música, voz ni pistas extra)');
  for (const p of i.pistas) L.push(`  ${p.nombre.padEnd(10)} ${p.desdeSec === null ? 'no suena' : `de ${t2(p.desdeSec)} a ${t2(p.hastaSec!)}  nivel ${p.nivelDb} dBFS, pico ${p.picoDb} dBFS`}`);
  for (const p of i.propios) L.push(`  audio propio de "${p.escena}": de ${t2(p.desdeSec)} a ${t2(p.hastaSec)}`);
  L.push('');
  L.push(`Línea de tiempo (cuadro, segundo, qué pasa)`);
  for (const e of i.lineaDeTiempo) L.push(`  f${String(e.frame).padStart(5)}  ${t2(e.tSec).padStart(8)}  ${e.texto}`);
  L.push('');
  const r = i.resumen;
  L.push(`Cues: ${r.cues} (sobresale ${r.porEstado.sobresale}, justo ${r.porEstado.justo}, casi tapado ${r.porEstado['casi-tapado']}, tapado ${r.porEstado.tapado}, sin música ${r.porEstado.libre}, inaudible ${r.porEstado.inaudible})`);
  L.push(`  margen = nivel del efecto menos nivel de la música en su instante (RMS, ventana de ${VENTANA_EFECTO_SEC} s, música con el ducking aplicado); sobresale >= ${MARGEN_SOBRESALE_DB} dB, justo 0 a ${MARGEN_SOBRESALE_DB}, casi tapado ${MARGEN_TAPADO_DB} a 0, tapado < ${MARGEN_TAPADO_DB}`);
  for (const c of i.cues) {
    L.push(`  ${String(c.n).padStart(3)}  f${String(c.frame).padStart(5)}  ${c.sfx.padEnd(14)} ${c.estado.padEnd(11)} efecto ${c.efectoDb ?? '-'} dBFS, música ${c.musicaDb ?? '-'} dBFS${c.margenDb !== null ? `, margen ${c.margenDb > 0 ? '+' : ''}${c.margenDb} dB (sin ducking ${c.margenSinDuckDb !== null ? (c.margenSinDuckDb > 0 ? '+' : '') + c.margenSinDuckDb : '-'})` : ''}${c.pisaVoz ? '  [sobre la voz]' : ''}${c.enAudioPropio ? '  [en audio propio]' : ''}`);
  }
  L.push('');
  L.push(`Silencios: ${r.silencios === 0 ? 'ninguno' : r.silencios}`);
  for (const s of i.silencios) L.push(`  ${s.pista.padEnd(10)} ${t2(s.desdeSec)} a ${t2(s.hastaSec)} (${s.ubicacion}${s.motivo ? `, por ${s.motivo}` : ''})`);
  L.push('');
  L.push(`Solapamientos: ${r.solapamientos === 0 ? 'ninguno' : r.solapamientos}`);
  for (const s of i.solapamientos) L.push(`  ${s.a} con ${s.b}: ${t2(s.desdeSec)} a ${t2(s.hastaSec)}`);
  L.push('');
  L.push(`Voz (heurística de ritmo silábico, tono y banda; puntaje desde ${UMBRAL_VOZ_PROBABLE})`);
  if (i.voz.length === 0) L.push('  no se detectó voz en ninguna pista');
  for (const v of i.voz) L.push(`  ${v.pista.padEnd(10)} ${t2(v.desdeSec)} a ${t2(v.hastaSec)}  ${v.esperada ? 'pedida' : 'NO pedida'}`);
  L.push('');
  L.push(i.avisos.length === 0 ? 'Sin avisos.' : `Avisos (${i.avisos.length})`);
  for (const a of i.avisos) L.push(`  - ${a}`);
  return L.join('\n');
}
