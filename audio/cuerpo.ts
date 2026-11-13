// Cuerpo de una pista: el tramo entre una intro casi muda (o muy baja) y la caída final (fade-out
// o cola). Es donde se puede armar un lazo sin que el empalme caiga en el silencio. Núcleo puro:
// recibe PCM mono y mide el nivel con ventanas de 0,5 s.

export interface Cuerpo {
  /** Segundo donde termina la intro baja (0 si la pista arranca fuerte). */
  inicioSec: number;
  /** Segundo donde empieza la caída final (la duración si la pista corta en seco). */
  finSec: number;
  /** Nivel típico del cuerpo (RMS en dB, percentil 60 de las ventanas de 0,5 s). */
  nivelDb: number;
  /** La pista tiene una intro baja (más de 12 dB por debajo del cuerpo). */
  introBaja: boolean;
  /** Segundos de caída final detectados (duración - finSec). */
  colaSec: number;
}

const VENTANA = 0.5;
const SALTO = 0.25;
/** La intro es "baja" por debajo de esta distancia (dB) del nivel del cuerpo. */
export const UMBRAL_INTRO_DB = 12;
/** La cola empieza cuando el nivel baja más de esto (dB) respecto del cuerpo. */
export const UMBRAL_COLA_DB = 6;

export function detectarCuerpo(x: Float32Array, sr: number): Cuerpo {
  const dur = x.length / sr;
  const w = Math.max(1, Math.round(VENTANA * sr));
  const h = Math.max(1, Math.round(SALTO * sr));
  const e: number[] = [];
  for (let i = 0; i + w <= x.length; i += h) {
    let s = 0;
    for (let j = i; j < i + w; j++) s += x[j] * x[j];
    e.push(10 * Math.log10(s / w + 1e-12));
  }
  const entera: Cuerpo = { inicioSec: 0, finSec: dur, nivelDb: e.length ? e[0] : -120, introBaja: false, colaSec: 0 };
  if (e.length < 8) return entera;
  const orden = [...e].sort((a, b) => a - b);
  const nivel = orden[Math.floor(0.6 * (orden.length - 1))];
  let k0 = 0;
  while (k0 < e.length && e[k0] < nivel - UMBRAL_INTRO_DB) k0++;
  let k1 = e.length - 1;
  while (k1 > k0 && e[k1] < nivel - UMBRAL_COLA_DB) k1--;
  const inicio = k0 * SALTO;
  const fin = Math.min(dur, k1 * SALTO + VENTANA);
  if (fin - inicio < Math.min(2, dur / 2)) return { ...entera, nivelDb: nivel };
  return {
    inicioSec: Math.round(inicio * 1000) / 1000,
    finSec: Math.round(fin * 1000) / 1000,
    nivelDb: Math.round(nivel * 10) / 10,
    introBaja: k0 > 0,
    colaSec: Math.round((dur - fin) * 1000) / 1000,
  };
}
