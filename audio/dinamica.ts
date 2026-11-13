// Dinámica de la mezcla: ducking previsible de la música bajo los efectos y limitador de pico
// verdadero. Núcleo puro: trabaja sobre PCM en memoria, sin ffmpeg. Todo es de fase cero (se mira
// el futuro del audio entero), así que no hay retardo que compensar.

// --- Ducking ---------------------------------------------------------------------------------

export interface VentanaDuck {
  /** Muestras (de salida) entre las que el efecto suena por encima del umbral. */
  iniSample: number;
  finSample: number;
  /** Profundidad deseada (dB, positivo) mientras la ventana está activa. */
  profundidadDb: number;
}

/**
 * Curva de ganancia (lineal, mono) que baja la música `profundidadDb` mientras suena cada efecto.
 * La bajada termina justo al empezar el efecto (arranca `ataqueMs` antes: se conoce el futuro) y
 * la subida empieza al terminar y dura `releaseMs`; las dos son rampas en dB con perfil de coseno.
 * Con ventanas solapadas manda la más profunda (no se suman). La profundidad no depende del nivel
 * del efecto: es un parámetro.
 */
export function curvaDeDucking(ventanas: readonly VentanaDuck[], totalSamples: number, sr: number, ataqueMs = 10, releaseMs = 250): Float32Array {
  const db = new Float32Array(totalSamples); // 0 o negativo
  const at = Math.max(1, Math.round((ataqueMs / 1000) * sr));
  const re = Math.max(1, Math.round((releaseMs / 1000) * sr));
  for (const v of ventanas) {
    const d = -Math.abs(v.profundidadDb);
    if (d === 0) continue;
    const ini = Math.max(0, v.iniSample);
    const fin = Math.min(totalSamples, Math.max(ini, v.finSample));
    for (let i = Math.max(0, ini - at); i < Math.min(totalSamples, fin + re); i++) {
      let u: number;
      if (i < ini) u = 0.5 - 0.5 * Math.cos((Math.PI * (i - (ini - at) + 1)) / (at + 1)); // 0 a 1 en el ataque
      else if (i < fin) u = 1;
      else u = 0.5 + 0.5 * Math.cos((Math.PI * (i - fin + 1)) / (re + 1)); // 1 a 0 en la subida
      const g = d * u;
      if (g < db[i]) db[i] = g;
    }
  }
  const out = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) out[i] = Math.pow(10, db[i] / 20);
  return out;
}

/** Multiplica un PCM entrelazado de `canales` por una curva mono. */
export function aplicarCurva(x: Float32Array, curva: Float32Array, canales: number): void {
  const n = Math.min(curva.length, Math.floor(x.length / canales));
  for (let i = 0; i < n; i++) for (let c = 0; c < canales; c++) x[i * canales + c] *= curva[i];
}

export interface InfoEfecto {
  /** Tramo (en muestras relativas al inicio del efecto) donde el efecto, ya con su ganancia, supera el umbral. */
  activoSamples: number;
  /** Muestra (relativa) del pico de energía del efecto. */
  picoSamples: number;
}

/**
 * Analiza un efecto mono: cuánto dura por encima de `umbral` (amplitud lineal, medida sobre bloques
 * de 5 ms ya multiplicados por `gain`) y dónde cae su pico de energía (bloque de 10 ms más fuerte).
 */
export function analizarEfecto(x: Float32Array, sr: number, gain = 1, umbral = 0.02): InfoEfecto {
  const b = Math.max(1, Math.round(0.005 * sr));
  let ultimo = 0;
  for (let i = 0; i < x.length; i += b) {
    let m = 0;
    for (let j = i; j < Math.min(x.length, i + b); j++) m = Math.max(m, Math.abs(x[j]));
    if (m * gain >= umbral) ultimo = Math.min(x.length, i + b);
  }
  const w = Math.max(1, Math.round(0.01 * sr));
  let mejor = { i: 0, e: -1 };
  for (let i = 0; i + w <= x.length; i += Math.max(1, Math.round(w / 4))) {
    let e = 0;
    for (let j = i; j < i + w; j++) e += x[j] * x[j];
    if (e > mejor.e) mejor = { i, e };
  }
  return { activoSamples: ultimo, picoSamples: mejor.i + Math.round(w / 2) };
}

// --- Limitador de pico verdadero ---------------------------------------------------------------

/** Mínimo móvil centrado de ancho `2r+1` (deque; O(n)). */
function minimoMovil(x: Float32Array, r: number): Float32Array {
  const n = x.length;
  const out = new Float32Array(n);
  const q = new Int32Array(n + 1);
  let h = 0;
  let t = 0;
  let sig = 0;
  for (let i = 0; i < n; i++) {
    const hasta = Math.min(n - 1, i + r);
    while (sig <= hasta) {
      while (t > h && x[q[t - 1]] >= x[sig]) t--;
      q[t++] = sig++;
    }
    while (q[h] < i - r) h++;
    out[i] = x[q[h]];
  }
  return out;
}

/** Promedio móvil centrado de ancho `2r+1`; en los bordes se repite el primer y el último valor (no se inventa un 1). */
function promedioMovil(x: Float32Array, r: number): Float32Array {
  const n = x.length;
  const out = new Float32Array(n);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + x[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - r);
    const b = Math.min(n - 1, i + r);
    const izq = Math.max(0, r - i) * x[0];
    const der = Math.max(0, i + r - (n - 1)) * x[n - 1];
    out[i] = (pre[b + 1] - pre[a] + izq + der) / (2 * r + 1);
  }
  return out;
}

const FASES = 4;
const SEMITAPS = 12;
/** Interpolador de sobremuestreo x4 (sinc con ventana de Blackman): tres fases entre muestras. */
const COEF_FASES: Float64Array[] = (() => {
  const out: Float64Array[] = [];
  for (let p = 1; p < FASES; p++) {
    const h = new Float64Array(2 * SEMITAPS);
    const fr = p / FASES;
    for (let k = -SEMITAPS + 1; k <= SEMITAPS; k++) {
      const u = k - fr;
      const s = Math.sin(Math.PI * u) / (Math.PI * u);
      const w = 0.42 + 0.5 * Math.cos((Math.PI * u) / (SEMITAPS + 1)) + 0.08 * Math.cos((2 * Math.PI * u) / (SEMITAPS + 1));
      h[k + SEMITAPS - 1] = s * w;
    }
    out.push(h);
  }
  return out;
})();
const SUMA_ABS_MAX = Math.max(...COEF_FASES.map((h) => h.reduce((a, v) => a + Math.abs(v), 0)));

export interface OpcionesLimitador {
  /** Techo de pico verdadero en dBTP; -1 por defecto. */
  techoDbtp?: number;
  /** Mirada hacia adelante (y hacia atrás) en ms; 5 por defecto. */
  anticipoMs?: number;
  /** Tiempo de recuperación en ms; 80 por defecto. */
  releaseMs?: number;
}

export interface ResultadoLimitador {
  /** Reducción de ganancia máxima aplicada (dB, positivo). 0 si no hizo falta limitar. */
  reduccionMaxDb: number;
}

/**
 * Limita en el lugar un PCM entrelazado para que su pico verdadero (sobremuestreo x4) no pase de
 * `techoDbtp`. Es de fase cero: la ganancia se calcula mirando antes y después de cada cresta
 * (mínimo móvil + promedio móvil + recuperación), así que el audio no se retrasa ni una muestra.
 * Un margen interno de 0,1 dB cubre la diferencia entre el sobremuestreo x4 y uno mayor.
 */
export function limitar(x: Float32Array, canales: number, sr: number, o: OpcionesLimitador = {}): ResultadoLimitador {
  const techo = Math.pow(10, ((o.techoDbtp ?? -1) - 0.1) / 20);
  const L = Math.max(1, Math.round(((o.anticipoMs ?? 5) / 1000) * sr));
  const tauR = Math.max(1, ((o.releaseMs ?? 80) / 1000) * sr);
  const n = Math.floor(x.length / canales);
  // Máximo absoluto entre canales por muestra.
  const abs = new Float32Array(n);
  let pico = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let c = 0; c < canales; c++) m = Math.max(m, Math.abs(x[i * canales + c]));
    abs[i] = m;
    pico = Math.max(pico, m);
  }
  // Atajo: si ni con la peor interpolación se pasa del techo, no hay nada que hacer.
  if (pico * SUMA_ABS_MAX <= techo) return { reduccionMaxDb: 0 };
  // Pico verdadero estimado por muestra: el mayor entre la muestra y sus tres puntos interpolados hacia la siguiente.
  const r = new Float32Array(n).fill(1);
  const cota = techo / SUMA_ABS_MAX;
  for (let i = 0; i < n; i++) {
    // Solo hay que interpolar donde alguna muestra cercana puede dar un pico verdadero sobre el techo.
    let cerca = 0;
    for (let k = -SEMITAPS + 1; k <= SEMITAPS; k++) cerca = Math.max(cerca, abs[Math.min(n - 1, Math.max(0, i + k))]);
    let tp = abs[i];
    if (cerca > cota) {
      for (let c = 0; c < canales; c++) {
        for (const h of COEF_FASES) {
          let s = 0;
          for (let k = -SEMITAPS + 1; k <= SEMITAPS; k++) {
            const j = i + k;
            if (j >= 0 && j < n) s += x[j * canales + c] * h[k + SEMITAPS - 1];
          }
          tp = Math.max(tp, Math.abs(s));
        }
      }
    }
    if (tp > techo) r[i] = techo / tp;
  }
  // Ganancia: mínimo en [-L, L], suavizado con un promedio de igual ancho (g[n] <= r[n] siempre) y recuperación gradual.
  const g = promedioMovil(minimoMovil(r, L), L);
  const rec = 1 - Math.exp(-1 / tauR);
  let ant = 1;
  let minG = 1;
  for (let i = 0; i < n; i++) {
    let v = g[i];
    const sube = ant + (1 - ant) * rec;
    if (v > sube) v = sube;
    ant = v;
    minG = Math.min(minG, v);
    if (v < 1) for (let c = 0; c < canales; c++) x[i * canales + c] *= v;
  }
  return { reduccionMaxDb: Math.round(-20 * Math.log10(minG) * 100) / 100 };
}
