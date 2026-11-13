// Estimación de tempo, pulsos y entrada de la percusión. Núcleo puro: recibe PCM mono.
// Método: envolvente de inicios (diferencia positiva del log de la energía de la señal
// derivada, ventanas de 10 ms) y búsqueda de "peine" (promedio de la envolvente en una
// grilla de pulsos) sobre tempo y fase, con una preferencia suave por tempos cercanos a 120.

export const TEMPO_SR = 22050;
const HOP = 220; // 10 ms a 22050 Hz
export const HOP_SEC = HOP / TEMPO_SR;

export interface TempoOpts {
  minBpm?: number;
  maxBpm?: number;
  /** Tempo central de la preferencia (desempata octavas: 70 contra 140). */
  prior?: number;
}

export interface TempoResult {
  bpm: number;
  /** 0 a 1; heurística: cuánto sobresale la grilla de pulsos respecto del promedio de la envolvente. */
  confidence: number;
  /** Segundo del primer pulso de la grilla, en [0, período). */
  offsetSec: number;
  /** Segundo donde entra la percusión sostenida, o null si no se encontró. */
  percussionStartSec: number | null;
  durationSec: number;
}

export function onsetEnvelope(x: Float32Array): Float32Array {
  const n = Math.floor(x.length / HOP);
  const logE = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (let j = i * HOP; j < (i + 1) * HOP; j++) {
      const d = x[j] - (j > 0 ? x[j - 1] : 0);
      e += d * d;
    }
    logE[i] = Math.log1p((e / HOP) * 1e4);
  }
  const env = new Float32Array(n);
  for (let i = 1; i < n; i++) env[i] = Math.max(0, logE[i] - logE[i - 1]);
  return env;
}

function suavizar(env: Float32Array): Float32Array {
  const s = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) {
    s[i] = 0.5 * env[i] + 0.25 * (env[i - 1] ?? 0) + 0.25 * (env[i + 1] ?? 0);
  }
  return s;
}

/** Valor interpolado de la envolvente en el tiempo t (el cuadro i está centrado en (i+0,5)*HOP_SEC). */
function muestra(s: Float32Array, t: number): number {
  const p = t / HOP_SEC - 0.5;
  const i = Math.floor(p);
  if (i < 0 || i + 1 >= s.length) return 0;
  const f = p - i;
  return s[i] * (1 - f) + s[i + 1] * f;
}

/** Puntaje de una grilla (bpm, fase) desde `desde` segundos: promedio de la envolvente en los pulsos. */
function puntaje(s: Float32Array, dur: number, bpm: number, fase: number, desde: number): number {
  const per = 60 / bpm;
  let k = Math.max(0, Math.ceil((desde - fase) / per));
  let suma = 0;
  let cant = 0;
  for (; fase + k * per < dur; k++) {
    suma += muestra(s, fase + k * per);
    cant++;
  }
  return cant ? suma / cant : 0;
}

/** Mejor fase para un tempo dado. */
function mejorFase(s: Float32Array, dur: number, bpm: number, desde: number, paso: number): { fase: number; valor: number } {
  const per = 60 / bpm;
  let mejor = { fase: 0, valor: -1 };
  for (let f = 0; f < per; f += paso) {
    const v = puntaje(s, dur, bpm, f, desde);
    if (v > mejor.valor) mejor = { fase: f, valor: v };
  }
  return mejor;
}

/** Primer inicio de percusión sostenida: al menos 4 golpes seguidos separados por menos de 1,5 s. */
export function percussionStart(env: Float32Array): number | null {
  let max = 0;
  for (const v of env) max = Math.max(max, v);
  if (max <= 0) return null;
  // Piso absoluto (en unidades de log-energía): ignora ruidos de fondo aunque sean lo más fuerte.
  const umbral = Math.max(0.3 * max, 1);
  const picos: { t: number; v: number }[] = [];
  for (let i = 1; i < env.length - 1; i++) {
    if (env[i] >= umbral && env[i] >= env[i - 1] && env[i] > env[i + 1]) {
      const t = (i + 0.5) * HOP_SEC;
      const ult = picos[picos.length - 1];
      if (ult && t - ult.t < 0.1) {
        if (env[i] > ult.v) {
          ult.t = t;
          ult.v = env[i];
        }
      } else picos.push({ t, v: env[i] });
    }
  }
  for (let i = 0; i + 3 < picos.length; i++) {
    let ok = true;
    for (let j = i; j < i + 3; j++) if (picos[j + 1].t - picos[j].t > 1.5) ok = false;
    if (ok) return picos[i].t;
  }
  return null;
}

export function estimateTempo(x: Float32Array, sr: number = TEMPO_SR, opts: TempoOpts & { bpm?: number; offsetSec?: number } = {}): TempoResult {
  if (sr !== TEMPO_SR) throw new Error(`estimateTempo espera ${TEMPO_SR} Hz (recibió ${sr}); decodificá con ese sr`);
  const { minBpm = 60, maxBpm = 190, prior = 120 } = opts;
  const dur = x.length / sr;
  const env = onsetEnvelope(x);
  const s = suavizar(env);
  const perc = percussionStart(env);
  const desde = perc === null ? 0 : Math.max(0, perc - 0.1);

  let media = 0;
  for (let i = Math.floor(desde / HOP_SEC); i < s.length; i++) media += s[i];
  media /= Math.max(1, s.length - Math.floor(desde / HOP_SEC));

  let bpm: number;
  let fase: number;
  let valor: number;
  if (opts.bpm !== undefined) {
    bpm = opts.bpm;
    const m = mejorFase(s, dur, bpm, desde, HOP_SEC / 4);
    fase = m.fase;
    valor = m.valor;
  } else {
    let mejor = { bpm: 0, ponderado: -1, valor: 0 };
    for (let b = minBpm; b <= maxBpm; b += 0.2) {
      const v = mejorFase(s, dur, b, desde, HOP_SEC).valor;
      const w = Math.exp(-0.5 * Math.log2(b / prior) ** 2);
      if (v * w > mejor.ponderado) mejor = { bpm: b, ponderado: v * w, valor: v };
    }
    bpm = mejor.bpm;
    fase = 0;
    valor = -1;
    // Refinamiento fino alrededor del mejor tempo.
    for (let b = mejor.bpm - 0.3; b <= mejor.bpm + 0.3; b += 0.01) {
      const m = mejorFase(s, dur, b, desde, HOP_SEC / 4);
      if (m.valor > valor) {
        valor = m.valor;
        bpm = b;
        fase = m.fase;
      }
    }
  }
  const per = 60 / bpm;
  if (opts.offsetSec !== undefined) fase = ((opts.offsetSec % per) + per) % per;
  const lift = media > 0 ? valor / media : 0;
  const confidence = lift <= 1 ? 0 : Math.min(1, 1 - 1 / lift);
  return {
    bpm: Math.round(bpm * 100) / 100,
    confidence: opts.bpm !== undefined ? 0 : Math.round(confidence * 1000) / 1000,
    offsetSec: Math.round(fase * 1000) / 1000,
    percussionStartSec: perc === null ? null : Math.round(perc * 1000) / 1000,
    durationSec: Math.round(dur * 1000) / 1000,
  };
}

/** Pulsos (segundos) de la grilla `offset + k * 60/bpm` dentro de [0, dur]. */
export function beatGrid(bpm: number, offsetSec: number, durationSec: number): number[] {
  const per = 60 / bpm;
  const out: number[] = [];
  for (let k = 0; offsetSec + k * per <= durationSec + 1e-9; k++) out.push(Math.round((offsetSec + k * per) * 1e6) / 1e6);
  return out;
}

export interface TempoReport {
  archivo?: string;
  fps: number;
  bpm: number;
  /** 0 a 1; vale 0 cuando el tempo fue forzado a mano con --bpm. */
  confidence: number;
  manual: boolean;
  durationSec: number;
  beatsSec: number[];
  /** Cuadro (fraccionario) de cada pulso; es lo que consume `audio/beats.ts`. */
  beatFrames: number[];
  percussionStart: { sec: number; frame: number } | null;
  /** Pulso de la grilla más cercano al inicio de la percusión. */
  percussionBeat: { sec: number; frame: number; index: number } | null;
}

export function tempoReport(x: Float32Array, fps: number, opts: TempoOpts & { bpm?: number; offsetSec?: number } = {}): TempoReport {
  const r = estimateTempo(x, TEMPO_SR, opts);
  const beatsSec = beatGrid(r.bpm, r.offsetSec, r.durationSec);
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const beatFrames = beatsSec.map((t) => r3(t * fps));
  let percussionBeat: TempoReport['percussionBeat'] = null;
  if (r.percussionStartSec !== null) {
    let bi = 0;
    beatsSec.forEach((t, i) => {
      if (Math.abs(t - r.percussionStartSec!) < Math.abs(beatsSec[bi] - r.percussionStartSec!)) bi = i;
    });
    percussionBeat = { sec: beatsSec[bi], frame: beatFrames[bi], index: bi };
  }
  return {
    fps,
    bpm: r.bpm,
    confidence: r.confidence,
    manual: opts.bpm !== undefined,
    durationSec: r.durationSec,
    beatsSec,
    beatFrames,
    percussionStart: r.percussionStartSec === null ? null : { sec: r.percussionStartSec, frame: r3(r.percussionStartSec * fps) },
    percussionBeat,
  };
}
