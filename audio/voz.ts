// Locución: la herramienta no genera voz. Lo que hace es admitir una pista de voz que aporta la persona (wav o mp3 local, nunca al repo),
// ubicarla en el video, detectar dónde habla (para bajar la música mientras tanto) y avisar si pisa un corte de escena.
// Núcleo puro: trabaja sobre PCM en memoria, sin ffmpeg. La voz propia, o con una licencia que permita usarla donde se muestra el video, es
// responsabilidad de quien la trae (ver docs/audio.md, "Locución").
import type { VentanaDuck } from './dinamica';

export interface VozOpts {
  /** Ruta al archivo de voz (wav, mp3...). Lo trae la persona; no se versiona. */
  archivo: string;
  /** Multiplicador lineal de la voz; 1 por defecto. */
  gain?: number;
  /** Segundo del archivo de voz desde el que arrancar (recorta un silencio o una cuenta regresiva del comienzo). */
  desdeSec?: number;
  /** Segundo del VIDEO en que entra la voz (0 por defecto): lo que pasa de ahí se recorta. */
  enSec?: number;
  /** Cuánto baja la música (dB) mientras habla la voz; 8 por defecto; 0 apaga el ducking. */
  duckDb?: number;
  /** Bajada de la música (ms) antes de que entre la voz; 60 por defecto. */
  duckAtaqueMs?: number;
  /** Subida de la música (ms) después de que la voz se calla; 450 por defecto. */
  duckReleaseMs?: number;
  /** Umbral absoluto (dBFS de RMS en bloques de 10 ms) bajo el cual no hay voz. Sin él se deduce del nivel de la propia pista (28 dB bajo su nivel típico). */
  umbralDb?: number;
  /** Pausas más cortas que esto (ms) no levantan la música: se tratan como una sola frase. 350 por defecto. */
  uneMs?: number;
}

export interface OpcionesDeteccion {
  /** Largo del bloque de análisis en ms (10 por defecto). */
  bloqueMs?: number;
  umbralDb?: number;
  /** Cuánto bajo el nivel típico (percentil 95 de los bloques con sonido) corre el umbral, en dB (28 por defecto). */
  relativoDb?: number;
  uneMs?: number;
  /** Tramos más cortos que esto (ms) se descartan como un clic o un golpe de micrófono (80 por defecto). */
  minMs?: number;
}

/** Piso absoluto de la detección: nunca se considera voz algo bajo este nivel (dBFS). */
const PISO_DB = -70;

/**
 * Tramos donde hay voz en una señal mono: RMS en bloques, umbral relativo al nivel típico de la pista (o absoluto con `umbralDb`), pausas
 * cortas unidas (`uneMs`) y tramos cortísimos descartados. Devuelve muestras `[iniSample, finSample)` de `x`. Función pura y determinista.
 */
export function ventanasDeVoz(x: Float32Array, sr: number, o: OpcionesDeteccion = {}): Array<{ iniSample: number; finSample: number }> {
  const bloque = Math.max(1, Math.round(((o.bloqueMs ?? 10) / 1000) * sr));
  const nb = Math.ceil(x.length / bloque);
  const nivel = new Float32Array(nb);
  for (let b = 0; b < nb; b++) {
    let e = 0;
    const ini = b * bloque;
    const fin = Math.min(x.length, ini + bloque);
    for (let i = ini; i < fin; i++) e += x[i]! * x[i]!;
    const rms = Math.sqrt(e / Math.max(1, fin - ini));
    nivel[b] = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  }
  let umbral = o.umbralDb;
  if (umbral === undefined) {
    const con = Array.from(nivel).filter((v) => v > PISO_DB).sort((a, b) => a - b);
    if (con.length === 0) return [];
    const p95 = con[Math.min(con.length - 1, Math.floor(con.length * 0.95))]!;
    umbral = Math.max(PISO_DB, p95 - (o.relativoDb ?? 28));
  }
  const une = Math.round((o.uneMs ?? 350) / ((bloque / sr) * 1000));
  const min = Math.max(1, Math.round((o.minMs ?? 80) / ((bloque / sr) * 1000)));
  const tramos: Array<[number, number]> = [];
  let ini = -1;
  let ultimoActivo = -1;
  for (let b = 0; b < nb; b++) {
    if (nivel[b]! >= umbral) {
      if (ini < 0) ini = b;
      else if (b - ultimoActivo > une) {
        tramos.push([ini, ultimoActivo + 1]);
        ini = b;
      }
      ultimoActivo = b;
    }
  }
  if (ini >= 0) tramos.push([ini, ultimoActivo + 1]);
  return tramos.filter(([a, b]) => b - a >= min).map(([a, b]) => ({ iniSample: a * bloque, finSample: Math.min(x.length, b * bloque) }));
}

export interface VozColocada {
  /** Voz estéreo entrelazada, de `n` muestras por canal, ya ubicada, con su ganancia y fundidos mínimos en los bordes. */
  estereo: Float32Array;
  /** Ventanas de ducking (muestras de salida) con la profundidad pedida; vacío si `duckDb` es 0. */
  ventanas: VentanaDuck[];
  avisos: string[];
}

/**
 * Ubica la voz decodificada (`crudo`: estéreo entrelazado a `sr`) en un video de `n` muestras: salta `desdeSec`, la corre a `enSec`, la
 * multiplica por `gain`, recorta lo que pasa del final (con un aviso) y le pone 5 ms de fundido en los bordes para que un corte seco no haga clic.
 * Avisa si la voz es muy baja o recorta (pasa de 0 dBFS), o si está en silencio.
 */
export function colocarVoz(crudo: Float32Array, sr: number, n: number, o: VozOpts): VozColocada {
  const avisos: string[] = [];
  const gain = o.gain ?? 1;
  if (!(gain >= 0)) throw new Error(`voz.gain inválido (${o.gain}): tiene que ser un número >= 0`);
  const desde = Math.round((o.desdeSec ?? 0) * sr);
  const en = Math.round((o.enSec ?? 0) * sr);
  if (desde < 0 || en < 0) throw new Error('voz.desdeSec y voz.enSec no pueden ser negativos');
  const estereo = new Float32Array(n * 2);
  const disponibles = Math.max(0, Math.floor(crudo.length / 2) - desde);
  const cuantas = Math.max(0, Math.min(disponibles, n - en));
  for (let i = 0; i < cuantas * 2; i++) estereo[en * 2 + i] = crudo[desde * 2 + i]! * gain;
  if (disponibles > n - en) avisos.push(`La voz dura más que el video: se recortan ${((disponibles - (n - en)) / sr).toFixed(2)} s del final.`);
  const fade = Math.min(Math.round(0.005 * sr), Math.floor(cuantas / 2));
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    for (let c = 0; c < 2; c++) {
      estereo[(en + i) * 2 + c]! *= g;
      estereo[(en + cuantas - 1 - i) * 2 + c]! *= g;
    }
  }
  let pico = 0;
  for (let i = 0; i < estereo.length; i++) pico = Math.max(pico, Math.abs(estereo[i]!));
  if (cuantas === 0 || pico === 0) avisos.push('La pista de voz está en silencio dentro del video (revisá --voz-desde y --voz-en).');
  else if (pico < 0.03) avisos.push(`La voz es muy baja (pico ${(20 * Math.log10(pico)).toFixed(1)} dBFS): subila con --voz-gain; --lufs la lleva al nivel de entrega.`);
  else if (pico >= 0.999) avisos.push('La voz llega a 0 dBFS: puede venir recortada. Grabala más baja; el limitador final no arregla un recorte que ya está en la grabación.');
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = (estereo[2 * i]! + estereo[2 * i + 1]!) / 2;
  const db = o.duckDb ?? 8;
  const tramos = ventanasDeVoz(mono, sr, { umbralDb: o.umbralDb, uneMs: o.uneMs });
  const ventanas: VentanaDuck[] = db > 0 ? tramos.map((t) => ({ ...t, profundidadDb: db })) : [];
  // Con duckDb 0 igual se informan los tramos (para `locucion`): van con profundidad 0.
  return { estereo, ventanas: db > 0 ? ventanas : tramos.map((t) => ({ ...t, profundidadDb: 0 })), avisos };
}

// ------------------------------------------------------------------------------------------ verificación contra los cortes

export interface TramoDeVoz {
  desde: number;
  hasta: number;
  /** Texto del subtítulo (si viene de uno); sirve para nombrar el tramo en el aviso. */
  texto?: string;
}

export type TipoAvisoVoz = 'cruza-corte' | 'roza-corte' | 'solapado' | 'fuera-del-video' | 'lectura-rapida';

export interface AvisoVoz {
  tipo: TipoAvisoVoz;
  mensaje: string;
  /** Instante (s) del corte o del tramo al que se refiere. */
  en: number;
}

export interface OpcionesVerificar {
  /** Cuánto puede pasar la voz de un corte (o arrancar antes) sin que cuente como "cruza" (0,25 s por defecto). Menos que eso es "roza". */
  toleranciaSec?: number;
  /** Duración del video (s): un tramo que termina después se avisa. */
  duracionSec?: number;
  /** Caracteres por segundo a partir de los cuales un subtítulo se lee mal (17 por defecto, el uso común para subtítulos). 0 lo apaga. */
  maxCps?: number;
}

const f2 = (s: number) => `${(Math.round(s * 100) / 100).toFixed(2)} s`;
const nombre = (t: TramoDeVoz) => (t.texto ? `"${t.texto.length > 40 ? t.texto.slice(0, 40).trimEnd() + '...' : t.texto}" (${f2(t.desde)} a ${f2(t.hasta)})` : `el tramo de ${f2(t.desde)} a ${f2(t.hasta)}`);

/**
 * Cruza los tramos de voz (los de los subtítulos o los detectados en la pista) con los cortes de escena y devuelve avisos:
 * - `cruza-corte`: la frase empieza antes y termina después del corte (pasa más de `toleranciaSec` de cada lado): partila o corré el corte.
 * - `roza-corte`: se pasa o arranca un instante respecto del corte (menos de la tolerancia): suele corregirse moviendo el corte unos cuadros.
 * - `solapado`: dos tramos se pisan.
 * - `fuera-del-video`: un tramo termina después del final.
 * - `lectura-rapida`: un subtítulo pide más caracteres por segundo de los que se leen cómodos.
 * Es una función pura: los cortes y los tiempos vienen en segundos.
 */
export function verificarVozEscenas(tramos: readonly TramoDeVoz[], cortesSec: readonly number[], o: OpcionesVerificar = {}): AvisoVoz[] {
  const tol = o.toleranciaSec ?? 0.25;
  const avisos: AvisoVoz[] = [];
  const orden = [...tramos].sort((a, b) => a.desde - b.desde);
  for (const corte of [...cortesSec].sort((a, b) => a - b)) {
    for (const t of orden) {
      if (!(t.desde < corte && t.hasta > corte)) continue;
      const antes = corte - t.desde;
      const despues = t.hasta - corte;
      if (antes > tol && despues > tol) {
        avisos.push({ tipo: 'cruza-corte', en: corte, mensaje: `${nombre(t)} cruza el corte de escena de ${f2(corte)} (${f2(antes)} antes, ${f2(despues)} después): partila en el corte o corré el corte.` });
      } else {
        const lado = despues <= tol ? `se pasa ${f2(despues)} del corte` : `arranca ${f2(antes)} antes del corte`;
        avisos.push({ tipo: 'roza-corte', en: corte, mensaje: `${nombre(t)} ${lado} de ${f2(corte)}: movelo unos cuadros para que quede de un solo lado.` });
      }
    }
  }
  for (let i = 1; i < orden.length; i++) {
    const a = orden[i - 1]!;
    const b = orden[i]!;
    if (b.desde < a.hasta - 1e-6) avisos.push({ tipo: 'solapado', en: b.desde, mensaje: `${nombre(a)} y ${nombre(b)} se pisan (${f2(a.hasta - b.desde)}).` });
  }
  if (o.duracionSec !== undefined) {
    for (const t of orden) if (t.hasta > o.duracionSec + 1e-6) avisos.push({ tipo: 'fuera-del-video', en: t.hasta, mensaje: `${nombre(t)} termina después del final del video (${f2(o.duracionSec)}).` });
  }
  const maxCps = o.maxCps ?? 17;
  if (maxCps > 0) {
    for (const t of orden) {
      if (!t.texto) continue;
      const cps = Array.from(t.texto.replace(/\s+/g, '')).length / Math.max(0.001, t.hasta - t.desde);
      if (cps > maxCps) avisos.push({ tipo: 'lectura-rapida', en: t.desde, mensaje: `${nombre(t)} pide ${cps.toFixed(1)} caracteres por segundo (se leen cómodo hasta ${maxCps}): alargalo o dividilo.` });
    }
  }
  return avisos.sort((a, b) => a.en - b.en);
}
