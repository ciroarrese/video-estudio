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
  /** `medio` corre la grilla medio pulso (corrección manual cuando la fase cae en el contratiempo). */
  fase?: 'medio';
}

export type TipoSeccion = 'entrada' | 'percusion' | 'energia' | 'caida';

export interface Seccion {
  /** Segundo del cambio (ajustado al golpe más cercano). */
  sec: number;
  /** `entrada`: la música sale de un tramo casi mudo; `percusion`: sube la densidad de golpes; `energia`: sube el nivel; `caida`: baja el nivel o los golpes. */
  tipo: TipoSeccion;
  /** Cambio de nivel (dB) entre los 4 s siguientes y los 4 s anteriores. */
  deltaDb: number;
  /** Cambio de golpes fuertes por segundo entre los 4 s siguientes y los 4 s anteriores. */
  deltaGolpes: number;
}

export interface TempoResult {
  bpm: number;
  /** 0 a 1; heurística: cuánto sobresale la grilla de pulsos respecto del promedio de la envolvente. */
  confidence: number;
  /** Segundo del primer pulso de la grilla, en [0, período). */
  offsetSec: number;
  /**
   * Qué tan clara es la fase (0 a 1): diferencia relativa entre la grilla elegida y la corrida medio pulso,
   * combinando la envolvente general y la banda grave (bombo). Por debajo de 0,05 las dos son casi iguales.
   */
  phaseConfidence: number;
  /** Segundo del primer pulso de la grilla alternativa (medio pulso corrida), la que se obtiene con `--fase medio`. */
  offsetAltSec: number;
  /** Segundo donde entra la percusión sostenida, o null si no se encontró. */
  percussionStartSec: number | null;
  /** Cambios de sección detectados (subidas de nivel o de golpes, entradas y caídas). */
  secciones: Seccion[];
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

interface Golpe {
  t: number;
  v: number;
}

/** Picos de la envolvente de inicios (mínimo 0,1 s entre dos) con altura de al menos `umbral`. */
function picosDeInicios(env: Float32Array, umbral: number): Golpe[] {
  const picos: Golpe[] = [];
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
  return picos;
}

/** Percentil 95 de las alturas de los picos de inicios (piso absoluto de 1 en log-energía): referencia robusta del "golpe fuerte". */
function referenciaDeGolpes(env: Float32Array): number {
  const h = picosDeInicios(env, 1).map((p) => p.v).sort((a, b) => a - b);
  return h.length ? h[Math.floor(0.95 * (h.length - 1))] : 0;
}

/** Fracción de la referencia (percentil 95 de los picos) que tiene que alcanzar un golpe para contar como golpe fuerte. */
const FRACCION_GOLPE = 0.5;

/**
 * Primer inicio de percusión sostenida: al menos 4 golpes fuertes seguidos separados por menos de 1,5 s.
 * "Fuerte" es relativo al percentil 95 de los picos (no al máximo): el resultado casi no cambia si se
 * recorta un tramo del final, que es donde un pico suelto movía el umbral y con él el resultado.
 */
export function percussionStart(env: Float32Array, fraccion: number = FRACCION_GOLPE): number | null {
  const ref = referenciaDeGolpes(env);
  if (ref <= 0) return null;
  const picos = picosDeInicios(env, Math.max(fraccion * ref, 1));
  for (let i = 0; i + 3 < picos.length; i++) {
    let ok = true;
    for (let j = i; j < i + 3; j++) if (picos[j + 1].t - picos[j].t > 1.5) ok = false;
    if (ok) return picos[i].t;
  }
  return null;
}

/**
 * Cambios de sección: compara, segundo a segundo, el nivel (RMS) y la densidad de golpes fuertes de los
 * 4 s siguientes con los 4 s anteriores; guarda los máximos locales (a 8 s entre sí como mínimo) que
 * pasan 3 dB o 2 golpes por segundo. Ignora vaivenes dentro de un tramo casi mudo.
 */
export function detectarSecciones(x: Float32Array, env: Float32Array): Seccion[] {
  const sr = TEMPO_SR;
  const n = Math.floor(x.length / sr);
  if (n < 6) return [];
  const ref = referenciaDeGolpes(env);
  const golpes = ref > 0 ? picosDeInicios(env, Math.max(FRACCION_GOLPE * ref, 1)) : [];
  const e: number[] = [];
  const d: number[] = new Array<number>(n).fill(0);
  for (let f = 0; f < n; f++) {
    let a = 0;
    for (let i = f * sr; i < (f + 1) * sr; i++) a += x[i] * x[i];
    e.push(10 * Math.log10(a / sr + 1e-10));
  }
  for (const g of golpes) {
    const f = Math.floor(g.t);
    if (f < n) d[f]++;
  }
  const W = 4;
  const media = (a: number[], i: number, j: number): number => {
    let s = 0;
    let c = 0;
    for (let k = Math.max(0, i); k < Math.min(a.length, j); k++) {
      s += a[k];
      c++;
    }
    return c ? s / c : 0;
  };
  const orden = [...e].sort((p, q) => p - q);
  const piso = orden[Math.floor(0.9 * (orden.length - 1))] - 20; // por debajo de esto el tramo es casi mudo
  const filas: { t: number; de: number; dd: number; antes: number; despues: number; score: number }[] = [];
  for (let t = 2; t < n - 1; t++) {
    const antes = media(e, t - W, t);
    const despues = media(e, t, t + W);
    if (Math.max(antes, despues) < piso) continue;
    const de = despues - antes;
    const dd = media(d, t, t + W) - media(d, t - W, t);
    const score = Math.max(Math.abs(de) / 3, Math.abs(dd) / 2);
    if (score >= 1) filas.push({ t, de, dd, antes, despues, score });
  }
  // Máximos locales con separación mínima: se toma el más fuerte y se descartan los vecinos a menos de 8 s.
  const elegidas: typeof filas = [];
  for (const f of [...filas].sort((p, q) => q.score - p.score)) {
    if (elegidas.every((o) => Math.abs(o.t - f.t) >= 8)) elegidas.push(f);
  }
  return elegidas
    .sort((p, q) => p.t - q.t)
    .map((f) => {
      const tipo: TipoSeccion =
        f.antes < piso || f.de >= 10 ? 'entrada' : Math.abs(f.dd) / 2 >= Math.abs(f.de) / 3 ? (f.dd > 0 ? 'percusion' : 'caida') : f.de > 0 ? 'energia' : 'caida';
      // Se ajusta al primer golpe fuerte cerca del cambio; si no hay, queda en el segundo.
      const cerca = (golpes.length ? golpes : picosDeInicios(env, 1)).find((g) => g.t >= f.t - 1 && g.t <= f.t + 3);
      const sec = tipo === 'caida' ? f.t : cerca ? cerca.t : f.t;
      return { sec: Math.round(sec * 1000) / 1000, tipo, deltaDb: Math.round(f.de * 10) / 10, deltaGolpes: Math.round(f.dd * 10) / 10 };
    });
}

/** Envolvente de inicios de la banda grave (bajo 150 Hz): sube cuando entra un bombo o un bajo. */
export function lowOnsetEnvelope(x: Float32Array): Float32Array {
  const n = Math.floor(x.length / HOP);
  const a = Math.exp((-2 * Math.PI * 150) / TEMPO_SR);
  let s1 = 0;
  let s2 = 0;
  const logE = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let e = 0;
    for (let j = i * HOP; j < (i + 1) * HOP; j++) {
      s1 = (1 - a) * x[j] + a * s1;
      s2 = (1 - a) * s1 + a * s2;
      e += s2 * s2;
    }
    logE[i] = Math.log1p((e / HOP) * 1e5);
  }
  const env = new Float32Array(n);
  for (let i = 1; i < n; i++) env[i] = Math.max(0, logE[i] - logE[i - 1]);
  return env;
}

/** Valor máximo de la envolvente a +-2 cuadros (20 ms) de `t`: tolera el retardo del filtro grave. */
function cercano(s: Float32Array, t: number): number {
  const c = Math.round(t / HOP_SEC - 0.5);
  let m = 0;
  for (let k = -2; k <= 2; k++) m = Math.max(m, s[c + k] ?? 0);
  return m;
}

function puntajeCercano(s: Float32Array, dur: number, bpm: number, fase: number, desde: number): number {
  const per = 60 / bpm;
  let k = Math.max(0, Math.ceil((desde - fase) / per));
  let suma = 0;
  let cant = 0;
  for (; fase + k * per < dur; k++) {
    suma += cercano(s, fase + k * per);
    cant++;
  }
  return cant ? suma / cant : 0;
}

/**
 * Decide entre la fase `f` y la corrida medio pulso. La envolvente general suele empatar cuando hay
 * platillos en las corcheas, así que se suma (con más peso) la diferencia en la banda grave: el
 * bombo cae sobre el pulso y no sobre el contratiempo. Devuelve la fase elegida, la otra y la confianza.
 */
function desempatarFase(s: Float32Array, low: Float32Array, dur: number, bpm: number, f: number, desde: number): { fase: number; alt: number; confianza: number } {
  const per = 60 / bpm;
  const g = (f + per / 2) % per;
  const m1 = puntaje(s, dur, bpm, f, desde);
  const m2 = puntaje(s, dur, bpm, g, desde);
  const l1 = puntajeCercano(low, dur, bpm, f, desde);
  const l2 = puntajeCercano(low, dur, bpm, g, desde);
  let mediaGrave = 0;
  const i0 = Math.floor(desde / HOP_SEC);
  for (let i = i0; i < low.length; i++) mediaGrave += low[i];
  mediaGrave /= Math.max(1, low.length - i0);
  const dm = (m1 - m2) / Math.max(m1, m2, 1e-9);
  // Solo cuenta el grave si alguna de las dos grillas se despega del promedio (hay golpes graves marcados).
  const hayGrave = Math.max(l1, l2) >= 1.3 * mediaGrave && Math.max(l1, l2) > 0;
  const dl = hayGrave ? (l1 - l2) / Math.max(l1, l2) : 0;
  const d = dm + 2 * dl;
  const confianza = Math.min(1, Math.abs(d));
  return d >= 0 ? { fase: f, alt: g, confianza } : { fase: g, alt: f, confianza };
}

export function estimateTempo(x: Float32Array, sr: number = TEMPO_SR, opts: TempoOpts & { bpm?: number; offsetSec?: number } = {}): TempoResult {
  if (sr !== TEMPO_SR) throw new Error(`estimateTempo espera ${TEMPO_SR} Hz (recibió ${sr}); decodificá con ese sr`);
  const { minBpm = 60, maxBpm = 190, prior = 120 } = opts;
  const dur = x.length / sr;
  const env = onsetEnvelope(x);
  const s = suavizar(env);
  const perc = percussionStart(env);
  // El tramo que se analiza arranca en el primer "groove" (umbral más bajo que el de la percusión
  // fuerte): usa más material para el tempo sin contar el ruido de una intro casi muda.
  const groove = percussionStart(env, 0.3);
  const desde = groove === null ? 0 : Math.max(0, groove - 0.1);

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
  let phaseConfidence = 1;
  let alt = (fase + per / 2) % per;
  if (opts.offsetSec !== undefined) {
    fase = ((opts.offsetSec % per) + per) % per;
    alt = (fase + per / 2) % per;
  } else {
    // La fase por la envolvente general puede caer medio pulso corrida (platillos en las corcheas):
    // se desempata con el grave.
    const r = desempatarFase(s, lowOnsetEnvelope(x), dur, bpm, fase, desde);
    fase = r.fase;
    alt = r.alt;
    phaseConfidence = r.confianza;
  }
  if (opts.fase === 'medio') {
    const t = fase;
    fase = alt;
    alt = t;
  }
  const lift = media > 0 ? valor / media : 0;
  const confidence = lift <= 1 ? 0 : Math.min(1, 1 - 1 / lift);
  return {
    bpm: Math.round(bpm * 100) / 100,
    confidence: opts.bpm !== undefined ? 0 : Math.round(confidence * 1000) / 1000,
    offsetSec: Math.round(fase * 1000) / 1000,
    phaseConfidence: Math.round(phaseConfidence * 1000) / 1000,
    offsetAltSec: Math.round(alt * 1000) / 1000,
    percussionStartSec: perc === null ? null : Math.round(perc * 1000) / 1000,
    secciones: detectarSecciones(x, env),
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
  /** 0 a 1: qué tan clara es la fase del pulso (la grilla elegida contra la corrida medio pulso). Menos de 0,05: casi un empate. */
  phaseConfidence: number;
  /** Se aplicó `--fase medio` (la grilla se corrió medio pulso a mano). */
  faseMedio: boolean;
  durationSec: number;
  beatsSec: number[];
  /** Cuadro (fraccionario) de cada pulso; es lo que consume `audio/beats.ts`. */
  beatFrames: number[];
  percussionStart: { sec: number; frame: number } | null;
  /** Pulso de la grilla más cercano al inicio de la percusión. */
  percussionBeat: { sec: number; frame: number; index: number } | null;
  /** Cambios de sección detectados (numerados desde 1; `--inicio seccion:<n>`). Puede haber más de uno antes de que "entre la percusión". */
  secciones: { n: number; sec: number; frame: number; tipo: TipoSeccion; deltaDb: number; deltaGolpes: number }[];
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
    phaseConfidence: r.phaseConfidence,
    faseMedio: opts.fase === 'medio',
    durationSec: r.durationSec,
    beatsSec,
    beatFrames,
    percussionStart: r.percussionStartSec === null ? null : { sec: r.percussionStartSec, frame: r3(r.percussionStartSec * fps) },
    percussionBeat,
    secciones: r.secciones.map((c, i) => ({ n: i + 1, sec: c.sec, frame: r3(c.sec * fps), tipo: c.tipo, deltaDb: c.deltaDb, deltaGolpes: c.deltaGolpes })),
  };
}

/** Pulso de la grilla más cercano a `sec`. */
export function pulsoMasCercano(beatsSec: readonly number[], sec: number): number {
  let bi = 0;
  beatsSec.forEach((t, i) => {
    if (Math.abs(t - sec) < Math.abs(beatsSec[bi] - sec)) bi = i;
  });
  return beatsSec[bi];
}

/** Aviso cuando la fase es casi un empate entre el pulso y el contratiempo (o undefined si está clara). */
export function avisoDeFase(t: Pick<TempoReport, 'phaseConfidence' | 'manual' | 'faseMedio'>): string | undefined {
  if (t.manual || t.faseMedio) return undefined;
  if (t.phaseConfidence < 0.05) {
    return `la fase del pulso es ambigua (confianza ${t.phaseConfidence}): la grilla podría estar medio pulso corrida. Escuchá el empalme; si cae en el contratiempo, repetí con --fase medio`;
  }
  return undefined;
}

/** Por debajo de esta confianza se avisa; en 0 (sin pulso detectable) se rechaza. */
export const CONFIANZA_AVISO = 0.3;

/**
 * Decide qué hacer con una estimación de tempo antes de empalmar. Confianza 0 sin tempo forzado
 * significa que la señal no tiene pulso (silencio, ruido, ambiente): la grilla sería inventada,
 * así que se rechaza. Entre 0 y `CONFIANZA_AVISO` se avisa pero se sigue. Con `manual` no se juzga.
 */
export function chequearConfianza(t: Pick<TempoReport, 'confidence' | 'manual' | 'bpm'>): { error?: string; aviso?: string } {
  if (t.manual) return {};
  if (t.confidence <= 0) {
    return { error: 'No se detectó un pulso en la pista (silencio o sin ritmo marcado): la grilla sería inventada. Pasá el tempo a mano con --bpm y --offset (segundo del primer pulso).' };
  }
  if (t.confidence < CONFIANZA_AVISO) {
    return { aviso: `confianza baja (${t.confidence}, ${t.bpm} bpm); revisá el BPM o forzalo con --bpm y --offset` };
  }
  return {};
}
