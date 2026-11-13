// Señales sintéticas deterministas para probar las herramientas de audio (no son música: no se distribuyen).

/** Tren de clics a `bpm`, con un colchón suave (pad) opcional que dura toda la pista. Mono. */
export function pistaDeClics(o: { bpm: number; seconds: number; sr: number; padSec?: number; clicksHasta?: number; amplitud?: number }): Float32Array {
  const { bpm, seconds, sr, padSec = 0, amplitud = 0.8 } = o;
  const x = new Float32Array(Math.round(seconds * sr));
  if (padSec > 0) {
    for (let i = 0; i < x.length; i++) {
      const t = i / sr;
      x[i] = 0.04 * Math.sin(2 * Math.PI * 196 * t) + 0.03 * Math.sin(2 * Math.PI * 247 * t);
    }
  }
  const per = 60 / bpm;
  const hasta = o.clicksHasta ?? seconds;
  for (let k = 0; padSec + k * per < hasta - 0.05; k++) {
    const i0 = Math.round((padSec + k * per) * sr);
    for (let j = 0; j < 0.03 * sr && i0 + j < x.length; j++) {
      const t = j / sr;
      x[i0 + j] += amplitud * Math.sin(2 * Math.PI * 2500 * t) * Math.exp(-t / 0.006);
    }
  }
  return x;
}

/** Mono a estéreo entrelazado. */
export function aEstereo(m: Float32Array): Float32Array {
  const s = new Float32Array(m.length * 2);
  for (let i = 0; i < m.length; i++) s[2 * i] = s[2 * i + 1] = m[i];
  return s;
}
