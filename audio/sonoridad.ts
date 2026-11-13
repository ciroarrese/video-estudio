// Sonoridad integrada (ITU-R BS.1770 / EBU R128) y pico verdadero. Núcleo puro: recibe PCM
// estéreo entrelazado (o mono) y no toca archivos.

interface Biquad {
  b: [number, number, number];
  a: [number, number];
}

/** Filtro K de la recomendación BS.1770: una repisa de agudos (stage 1) y un pasa-altos (stage 2), para cualquier sr. */
export function filtrosK(sr: number): [Biquad, Biquad] {
  const G = 3.999843853973347;
  const Q1 = 0.7071752369554196;
  const f1 = 1681.9744509555319;
  const K1 = Math.tan((Math.PI * f1) / sr);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  const a0 = 1 + K1 / Q1 + K1 * K1;
  const shelf: Biquad = {
    b: [(Vh + (Vb * K1) / Q1 + K1 * K1) / a0, (2 * (K1 * K1 - Vh)) / a0, (Vh - (Vb * K1) / Q1 + K1 * K1) / a0],
    a: [(2 * (K1 * K1 - 1)) / a0, (1 - K1 / Q1 + K1 * K1) / a0],
  };
  const Q2 = 0.5003270373238773;
  const f2 = 38.13547087613982;
  const K2 = Math.tan((Math.PI * f2) / sr);
  const c0 = 1 + K2 / Q2 + K2 * K2;
  const hp: Biquad = { b: [1, -2, 1], a: [(2 * (K2 * K2 - 1)) / c0, (1 - K2 / Q2 + K2 * K2) / c0] };
  return [shelf, hp];
}

function filtrar(x: Float64Array, f: Biquad): void {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const y = f.b[0] * v + f.b[1] * x1 + f.b[2] * x2 - f.a[0] * y1 - f.a[1] * y2;
    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = y;
    x[i] = y;
  }
}

/**
 * Sonoridad integrada en LUFS de `x` (entrelazado de `canales` canales; los de 1 o 2 canales pesan 1),
 * con bloques de 400 ms al 75 % de solapamiento y las dos compuertas (-70 LUFS absoluta y -10 LU relativa).
 * Devuelve -Infinity si no hay ningún bloque sobre la compuerta absoluta (silencio).
 */
export function sonoridadIntegrada(x: Float32Array, sr: number, canales: 1 | 2 = 2): number {
  const n = Math.floor(x.length / canales);
  const [shelf, hp] = filtrosK(sr);
  const cuad: Float64Array[] = [];
  for (let c = 0; c < canales; c++) {
    const ch = new Float64Array(n);
    for (let i = 0; i < n; i++) ch[i] = x[i * canales + c];
    filtrar(ch, shelf);
    filtrar(ch, hp);
    for (let i = 0; i < n; i++) ch[i] *= ch[i];
    cuad.push(ch);
  }
  const bloque = Math.round(0.4 * sr);
  const salto = Math.round(0.1 * sr);
  const z: number[] = [];
  for (let i0 = 0; i0 + bloque <= n; i0 += salto) {
    let tot = 0;
    for (const ch of cuad) {
      let s = 0;
      for (let i = i0; i < i0 + bloque; i++) s += ch[i];
      tot += s / bloque;
    }
    z.push(tot);
  }
  const lufs = (m: number) => -0.691 + 10 * Math.log10(m);
  const sobreAbs = z.filter((m) => m > 0 && lufs(m) > -70);
  if (sobreAbs.length === 0) return -Infinity;
  const media = sobreAbs.reduce((a, b) => a + b, 0) / sobreAbs.length;
  const relativa = lufs(media) - 10;
  const sobreRel = sobreAbs.filter((m) => lufs(m) > relativa);
  if (sobreRel.length === 0) return -Infinity;
  return lufs(sobreRel.reduce((a, b) => a + b, 0) / sobreRel.length);
}
