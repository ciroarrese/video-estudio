// Efectos de sonido sintetizados desde cero (fórmulas propias, sin muestras de terceros).
// Son deterministas: el mismo código produce los mismos bytes. Los archivos no se versionan:
// se generan a pedido con `tsx audio/cli.ts efectos`.
import { join } from 'node:path';
import { escribirWav16 } from './ffmpeg';

export const EFECTOS_SR = 48000;

type Gen = (sr: number) => Float32Array;

const TAU = 2 * Math.PI;

/** Ruido uniforme determinista (LCG de 32 bits). */
function ruido(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

const buf = (sr: number, seg: number) => new Float32Array(Math.round(seg * sr));

/** Normaliza al pico `pico` y aplica una caída de 3 ms al final para evitar un corte seco. */
function terminar(x: Float32Array, sr: number, pico = 0.8): Float32Array {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? pico / m : 1;
  const f = Math.round(0.003 * sr);
  for (let i = 0; i < x.length; i++) {
    x[i] *= g;
    const resto = x.length - i;
    if (resto < f) x[i] *= resto / f;
  }
  return x;
}

/** Nota con ataque inmediato y caída exponencial, con parciales opcionales. */
function nota(x: Float32Array, sr: number, ini: number, f: number, tau: number, amp: number, parciales: [number, number][] = [[1, 1]]) {
  const i0 = Math.round(ini * sr);
  for (let i = i0; i < x.length; i++) {
    const t = (i - i0) / sr;
    const env = Math.exp(-t / tau);
    if (env < 1e-4) break;
    let v = 0;
    for (const [m, a] of parciales) v += a * Math.sin(TAU * f * m * t);
    x[i] += amp * env * v;
  }
}

export const EFECTOS: Record<string, { descripcion: string; generar: Gen }> = {
  golpe: {
    descripcion: 'Golpe suave y grave (bombo corto).',
    generar: (sr) => {
      const x = buf(sr, 0.45);
      let fase = 0;
      for (let i = 0; i < x.length; i++) {
        const t = i / sr;
        const f = 50 + 90 * Math.exp(-t / 0.04);
        fase += (TAU * f) / sr;
        x[i] = Math.sin(fase) * Math.exp(-t / 0.12);
      }
      return terminar(x, sr);
    },
  },
  clic: {
    descripcion: 'Clic corto y seco (botón, selección).',
    generar: (sr) => {
      const x = buf(sr, 0.06);
      for (let i = 0; i < x.length; i++) {
        const t = i / sr;
        x[i] = Math.sin(TAU * 2600 * t) * Math.exp(-t / 0.004);
      }
      return terminar(x, sr);
    },
  },
  barrido: {
    descripcion: 'Barrido de aire ascendente (transición, whoosh).',
    generar: (sr) => {
      const x = buf(sr, 0.7);
      const r = ruido(7);
      let low = 0;
      let band = 0;
      for (let i = 0; i < x.length; i++) {
        const u = i / x.length;
        const fc = 300 * Math.pow(12, u); // 300 Hz a 3,6 kHz
        const k = 2 * Math.sin((Math.PI * fc) / sr);
        const q = 0.25;
        const high = r() - low - q * band;
        band += k * high;
        low += k * band;
        x[i] = band * Math.sin(Math.PI * u) ** 2;
      }
      return terminar(x, sr, 0.7);
    },
  },
  campanita: {
    descripcion: 'Campanita brillante (logro, destaque).',
    generar: (sr) => {
      const x = buf(sr, 1.2);
      nota(x, sr, 0, 1568, 0.35, 1, [[1, 1], [2.76, 0.35], [5.4, 0.15]]);
      return terminar(x, sr, 0.7);
    },
  },
  tilde: {
    descripcion: 'Dos notas ascendentes (confirmación, listo).',
    generar: (sr) => {
      const x = buf(sr, 0.5);
      nota(x, sr, 0, 880, 0.09, 1, [[1, 1], [2, 0.2]]);
      nota(x, sr, 0.09, 1320, 0.14, 1, [[1, 1], [2, 0.2]]);
      return terminar(x, sr, 0.7);
    },
  },
  aviso: {
    descripcion: 'Dos notas descendentes y suaves (atención, aviso).',
    generar: (sr) => {
      const x = buf(sr, 0.6);
      nota(x, sr, 0, 988, 0.1, 1, [[1, 1], [3, 0.1]]);
      nota(x, sr, 0.16, 740, 0.16, 1, [[1, 1], [3, 0.1]]);
      return terminar(x, sr, 0.7);
    },
  },
};

/** Genera todos los efectos como WAV mono de 16 bits en `carpeta`; devuelve las rutas. */
export function generarEfectos(carpeta: string, sr: number = EFECTOS_SR): string[] {
  return Object.entries(EFECTOS).map(([nombre, e]) => {
    const ruta = join(carpeta, `${nombre}.wav`);
    escribirWav16(ruta, e.generar(sr), sr, 1);
    return ruta;
  });
}
