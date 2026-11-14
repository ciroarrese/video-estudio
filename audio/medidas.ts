// Medidas de señal para las pruebas y para validar a mano (RMS, escalones, espectro por bandas,
// pico verdadero con sobremuestreo). Núcleo puro: recibe PCM, no toca archivos.

/** FFT iterativa en el lugar (radix 2). `re` e `im` tienen que tener largo potencia de 2. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Espectro de potencia (relleno con ceros a potencia de 2; con `hann` aplica una ventana de Hann). Devuelve `{ pot, df }`. */
export function espectroDePotencia(x: Float32Array, sr: number, hann = false): { pot: Float64Array; df: number } {
  let n = 1;
  while (n < x.length) n <<= 1;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < x.length; i++) re[i] = hann ? x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / x.length)) : x[i];
  fft(re, im);
  const pot = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) pot[k] = re[k] * re[k] + im[k] * im[k];
  return { pot, df: sr / n };
}

/** Fracción (0 a 1) de la energía que cae entre `f1` y `f2` Hz (sin ventana: es la energía real de la señal). */
export function fraccionDeEnergia(x: Float32Array, sr: number, f1: number, f2: number, hann = false): number {
  const { pot, df } = espectroDePotencia(x, sr, hann);
  let tot = 0;
  let banda = 0;
  for (let k = 0; k < pot.length; k++) {
    tot += pot[k];
    const f = k * df;
    if (f >= f1 && f < f2) banda += pot[k];
  }
  return tot > 0 ? banda / tot : 0;
}

/** Espectro en dB por bandas de tercio de octava entre 100 Hz y 12 kHz. */
export function espectroPorBandas(x: Float32Array, sr: number): number[] {
  const { pot, df } = espectroDePotencia(x, sr);
  const out: number[] = [];
  for (let f = 100; f * Math.pow(2, 1 / 3) <= 12000; f *= Math.pow(2, 1 / 3)) {
    const lo = f / Math.pow(2, 1 / 6);
    const hi = f * Math.pow(2, 1 / 6);
    let e = 0;
    for (let k = Math.ceil(lo / df); k * df < hi && k < pot.length; k++) e += pot[k];
    out.push(10 * Math.log10(e + 1e-12));
  }
  return out;
}

export function correlacion(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0;
}

/** RMS en dB de `x[i0 .. i0+n)` (con -200 de piso). */
export function rmsDb(x: ArrayLike<number>, i0: number, n: number, paso = 1): number {
  let e = 0;
  let c = 0;
  for (let i = Math.max(0, i0); i < Math.min(x.length, i0 + n); i += paso) {
    e += x[i] * x[i];
    c++;
  }
  return c ? 10 * Math.log10(e / c + 1e-20) : -200;
}

/** Escalón de nivel (dB) en el instante `t`: RMS de la ventana siguiente menos RMS de la anterior (valor absoluto). */
export function escalonRmsDb(x: ArrayLike<number>, sr: number, t: number, ventSec: number, paso = 1): number {
  const i = Math.round(t * sr);
  const w = Math.round(ventSec * sr);
  return Math.abs(rmsDb(x, i, w, paso) - rmsDb(x, i - w, w, paso));
}

/** Pico verdadero (dBTP) por sobremuestreo con sinc ventaneada; `x` es un canal, o entrelazado si `canales` > 1. */
export function picoVerdaderoDb(x: Float32Array, canales = 1, factor = 8): number {
  const T = 24; // semitaps por lado
  const fases: Float64Array[] = [];
  for (let p = 1; p < factor; p++) {
    const h = new Float64Array(2 * T);
    const fr = p / factor;
    for (let k = -T + 1; k <= T; k++) {
      const u = k - fr;
      const s = Math.abs(u) < 1e-12 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u);
      const w = 0.42 + 0.5 * Math.cos((Math.PI * u) / (T + 1)) + 0.08 * Math.cos((2 * Math.PI * u) / (T + 1));
      h[k + T - 1] = s * w;
    }
    fases.push(h);
  }
  const n = Math.floor(x.length / canales);
  let m = 0;
  for (let c = 0; c < canales; c++) {
    for (let i = 0; i < n; i++) {
      m = Math.max(m, Math.abs(x[i * canales + c]));
      if (Math.abs(x[i * canales + c]) < 0.2 * m) continue;
      for (const h of fases) {
        let s = 0;
        for (let k = -T + 1; k <= T; k++) {
          const j = i + k;
          if (j >= 0 && j < n) s += x[j * canales + c] * h[k + T - 1];
        }
        m = Math.max(m, Math.abs(s));
      }
    }
  }
  return 20 * Math.log10(m + 1e-12);
}

// --- Medidas de transitorios (clics) ----------------------------------------------------------

/** Pasaaltos de un polo en cascada sobre una copia (no toca la entrada). */
function pasaAltosCopia(x: ArrayLike<number>, sr: number, fc: number, pasadas = 2): Float32Array {
  const y = Float32Array.from(x as ArrayLike<number>);
  const a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
  for (let p = 0; p < pasadas; p++) {
    let lp = 0;
    for (let i = 0; i < y.length; i++) {
      lp += a * (y[i] - lp);
      y[i] -= lp;
    }
  }
  return y;
}

export interface OpcionesOnsets {
  /** Pasaaltos previo (Hz) para que el grave y el ruido de fondo no disparen nada. Por defecto 1000. */
  desdeHz?: number;
  /** Nivel (dB bajo el máximo de la envolvente) que dispara un evento. Por defecto -26. */
  disparoDb?: number;
  /** Nivel (dB bajo el máximo) al que tiene que volver la envolvente, durante `reposoMs`, para rearmar. Por defecto -38. */
  rearmeDb?: number;
  /** Tiempo (ms) que la envolvente tiene que quedar bajo el nivel de rearme. Por defecto 6. */
  reposoMs?: number;
}

/**
 * Detecta eventos percutivos (onsets) en `x`: envolvente de energía en ventanas de 0,5 ms sobre la señal filtrada
 * con un pasaaltos, con histéresis (se dispara cuando la envolvente supera `disparoDb` bajo su máximo y no se
 * rearma hasta que cae bajo `rearmeDb` durante `reposoMs`). Devuelve los instantes en segundos, con el inicio
 * llevado al comienzo del ataque (hacia atrás hasta 3 ms, mientras la envolvente siga 25 dB sobre el piso del disparo).
 */
export function detectarOnsets(x: ArrayLike<number>, sr: number, o: OpcionesOnsets = {}): number[] {
  const y = pasaAltosCopia(x, sr, o.desdeHz ?? 1000);
  const w = Math.max(1, Math.round(0.0005 * sr));
  const env: number[] = [];
  for (let i = 0; i + w <= y.length; i += w) {
    let e = 0;
    for (let j = i; j < i + w; j++) e += y[j] * y[j];
    env.push(10 * Math.log10(e / w + 1e-20));
  }
  const mx = Math.max(...env);
  const disparo = mx + (o.disparoDb ?? -26);
  const rearme = mx + (o.rearmeDb ?? -38);
  const reposo = Math.max(1, Math.round((o.reposoMs ?? 6) / 0.5));
  const out: number[] = [];
  let armado = true;
  let quieto = 0;
  for (let k = 0; k < env.length; k++) {
    if (armado && env[k] > disparo) {
      // El ataque empieza en la primera ventana (hasta 3 ms antes) que ya despega del piso.
      let ini = k;
      while (ini > 0 && k - ini < 6 && env[ini - 1] > disparo - 25) ini--;
      out.push((ini * w) / sr);
      armado = false;
      quieto = 0;
    } else if (!armado) {
      quieto = env[k] < rearme ? quieto + 1 : 0;
      if (quieto >= reposo) armado = true;
    }
  }
  return out;
}

/** Tiempo (ms) que tarda en acumularse el 90 % de la energía de `x[i0 .. i1)`, contado desde `i0`. */
export function duracion90Ms(x: ArrayLike<number>, sr: number, i0: number, i1: number): number {
  let tot = 0;
  for (let i = i0; i < i1; i++) tot += x[i] * x[i];
  let acc = 0;
  for (let i = i0; i < i1; i++) {
    acc += x[i] * x[i];
    if (acc >= 0.9 * tot) return ((i - i0 + 1) / sr) * 1000;
  }
  return ((i1 - i0) / sr) * 1000;
}

/**
 * Planitud espectral (Wiener) entre `f1` y `f2` Hz: media geométrica sobre media aritmética del espectro de
 * potencia, de 0 (un tono) a 1 (ruido blanco ideal; el periodograma de ruido blanco real da cerca de 0,56).
 * Usa una ventana rectangular de `ventMs` (por defecto 21,3 ms = 1024 muestras a 48 kHz) que arranca en `i0`.
 */
export function planitudEspectral(x: ArrayLike<number>, sr: number, i0: number, f1 = 1000, f2 = 10000, ventMs = 21.333): number {
  const n = Math.max(2, Math.round((ventMs / 1000) * sr));
  const seg = new Float32Array(n);
  for (let i = 0; i < n; i++) seg[i] = i0 + i < x.length && i0 + i >= 0 ? x[i0 + i] : 0;
  const { pot, df } = espectroDePotencia(seg, sr);
  let sumLog = 0;
  let sum = 0;
  let c = 0;
  for (let k = 0; k < pot.length; k++) {
    const f = k * df;
    if (f < f1 || f >= f2) continue;
    const p = pot[k] + 1e-18;
    sumLog += Math.log(p);
    sum += p;
    c++;
  }
  return c ? Math.exp(sumLog / c) / (sum / c) : 0;
}

/** Centroide espectral (Hz) de toda la señal. */
export function centroideEspectral(x: Float32Array, sr: number): number {
  const { pot, df } = espectroDePotencia(x, sr);
  let tot = 0;
  let cf = 0;
  pot.forEach((p, k) => {
    tot += p;
    cf += p * k * df;
  });
  return tot > 0 ? cf / tot : 0;
}

/**
 * Planitud espectral sobre bandas de tercio de octava entre `f1` y `f2` Hz (por defecto 1 a 8 kHz): media
 * geométrica sobre media aritmética de la potencia de cada banda, de 0 (toda la energía en una banda: un
 * tono) a 1 (la misma energía en todas). Es más robusta que la del periodograma, que en un transitorio
 * corto depende de cómo cayeron las fases. Ventana rectangular de `ventMs` desde `i0`.
 */
export function planitudPorBandas(x: ArrayLike<number>, sr: number, i0: number, f1 = 1000, f2 = 8000, ventMs = 21.333): number {
  const n = Math.max(2, Math.round((ventMs / 1000) * sr));
  const seg = new Float32Array(n);
  for (let i = 0; i < n; i++) seg[i] = i0 + i < x.length && i0 + i >= 0 ? x[i0 + i] : 0;
  const { pot, df } = espectroDePotencia(seg, sr);
  const bandas: number[] = [];
  for (let f = f1; f * Math.pow(2, 1 / 3) <= f2 * 1.0001; f *= Math.pow(2, 1 / 3)) {
    const hi = f * Math.pow(2, 1 / 3);
    let e = 0;
    for (let k = Math.ceil(f / df); k * df < hi && k < pot.length; k++) e += pot[k];
    bandas.push(e + 1e-18);
  }
  const media = bandas.reduce((a, b) => a + b, 0) / bandas.length;
  const geo = Math.exp(bandas.reduce((a, b) => a + Math.log(b), 0) / bandas.length);
  return geo / media;
}
