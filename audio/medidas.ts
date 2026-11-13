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
