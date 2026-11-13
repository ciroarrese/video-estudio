// Efectos de sonido sintetizados desde cero (fórmulas propias, sin muestras de terceros).
// Son deterministas: el mismo código produce los mismos bytes. Los archivos no se versionan:
// se generan a pedido con `tsx audio/cli.ts efectos`.
import { join } from 'node:path';
import { analizarEfecto } from './dinamica';
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

/** Resta la media (sin continua), entra en 0,5 ms, sale en 3 ms y normaliza al pico `pico`: la primera y la última muestra quedan en cero. */
function terminar(x: Float32Array, sr: number, pico = 0.8): Float32Array {
  let media = 0;
  for (const v of x) media += v;
  media /= x.length || 1;
  const fi = Math.max(1, Math.round(0.0005 * sr));
  const fo = Math.round(0.003 * sr);
  for (let i = 0; i < x.length; i++) {
    x[i] -= media;
    if (i < fi) x[i] *= i / fi;
    const resto = x.length - 1 - i;
    if (resto < fo) x[i] *= resto / fo;
  }
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? pico / m : 1;
  for (let i = 0; i < x.length; i++) x[i] *= g;
  return x;
}

/** Nota con ataque inmediato y caída exponencial, con parciales opcionales: [razón, amplitud, caída relativa (1 = la de la nota)]. */
function nota(x: Float32Array, sr: number, ini: number, f: number, tau: number, amp: number, parciales: [number, number, number?][] = [[1, 1]]) {
  const i0 = Math.round(ini * sr);
  for (let i = i0; i < x.length; i++) {
    const t = (i - i0) / sr;
    let v = 0;
    for (const [m, a, rel = 1] of parciales) v += a * Math.exp(-t / (tau * rel)) * Math.sin(TAU * f * m * t);
    if (Math.exp(-t / tau) < 1e-4) break;
    x[i] += amp * v;
  }
}

/** Ruido pasabanda (filtro de variables de estado) sobre `n` muestras con frecuencia central `fc(i)` y resonancia `q`. */
function ruidoBanda(n: number, sr: number, semilla: number, fc: (i: number) => number, q: number): Float32Array {
  const r = ruido(semilla);
  const y = new Float32Array(n);
  let low = 0;
  let band = 0;
  for (let i = 0; i < n; i++) {
    const k = 2 * Math.sin((Math.PI * fc(i)) / sr);
    const high = r() - low - q * band;
    band += k * high;
    low += k * band;
    y[i] = band;
  }
  return y;
}

export const EFECTOS: Record<string, { descripcion: string; generar: Gen }> = {
  golpe: {
    descripcion: 'Golpe suave y grave con ataque que se oye en parlantes chicos (bombo corto).',
    generar: (sr) => {
      const x = buf(sr, 0.35);
      let fase = 0;
      let fase2 = 0;
      // Cuerpo: barrido que se asienta en 120 Hz (antes bajaba a 50), saturado para que tenga armónicos
      // audibles en un celular o una laptop, más un "toc" entre 230 y 420 Hz y un chasquido seco en los medios.
      for (let i = 0; i < x.length; i++) {
        const t = i / sr;
        fase += (TAU * (120 + 250 * Math.exp(-t / 0.025))) / sr;
        fase2 += (TAU * (250 + 200 * Math.exp(-t / 0.02))) / sr;
        x[i] = 0.6 * Math.tanh(2 * Math.sin(fase) * Math.exp(-t / 0.04)) + 0.55 * Math.sin(fase2) * Math.exp(-t / 0.06);
      }
      const click = ruidoBanda(Math.round(0.012 * sr), sr, 5, () => 1500, 0.6);
      for (let i = 0; i < click.length; i++) x[i] += 1.1 * click[i] * Math.exp(-i / sr / 0.003);
      return terminar(x, sr);
    },
  },
  clic: {
    descripcion: 'Clic corto y seco, como un botón o una tecla (no un tono).',
    generar: (sr) => {
      const x = buf(sr, 0.05);
      // Ráfaga de ruido agudo (el "chasquido") sobre un cuerpo corto y resonante.
      const n = ruidoBanda(x.length, sr, 3, () => 5200, 0.8);
      for (let i = 0; i < x.length; i++) {
        const t = i / sr;
        x[i] = 0.9 * n[i] * Math.exp(-t / 0.0012) + 0.45 * Math.sin(TAU * 1250 * t) * Math.exp(-t / 0.005) + 0.3 * Math.sin(TAU * 2900 * t) * Math.exp(-t / 0.003);
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
        const fc = 180 * Math.pow(14, u); // 180 Hz a 2,5 kHz
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
    descripcion: 'Dos notas ascendentes de timbre brillante y percutido, como una marimba (confirmación, listo).',
    generar: (sr) => {
      const x = buf(sr, 0.5);
      // Percutida: el segundo parcial (a 4x) muere rápido, así cada nota "pica" y después queda un tono limpio.
      const p: [number, number, number?][] = [[1, 1], [4, 0.6, 0.18], [10, 0.25, 0.07]];
      nota(x, sr, 0, 659, 0.07, 0.8, p);
      nota(x, sr, 0.09, 988, 0.12, 1, p);
      return terminar(x, sr, 0.7);
    },
  },
  aviso: {
    descripcion: 'Dos notas descendentes de timbre grave y hueco, como una flauta (atención, aviso).',
    generar: (sr) => {
      const x = buf(sr, 0.7);
      // Solo armónicos impares (hueca, tipo clarinete) y entrada suave: nada que ver con el brillo de `tilde`.
      const p: [number, number, number?][] = [[1, 1], [3, 0.35], [5, 0.12]];
      nota(x, sr, 0, 440, 0.14, 1, p);
      nota(x, sr, 0.2, 330, 0.2, 0.9, p);
      for (let i = 0; i < Math.round(0.012 * sr); i++) x[i] *= i / Math.round(0.012 * sr);
      const j = Math.round(0.2 * sr);
      for (let i = 0; i < Math.round(0.012 * sr); i++) x[j + i] *= 0.4 + 0.6 * (i / Math.round(0.012 * sr));
      return terminar(x, sr, 0.7);
    },
  },
};

/**
 * Instante (segundos desde el inicio del archivo) del pico de energía de cada efecto: el centro de
 * la ventana de 10 ms más fuerte. Con `ancla: "pico"` en un cue, el efecto se adelanta ese tiempo
 * para que el pico caiga en el cuadro del cue.
 */
export function picosDeEfectos(sr: number = EFECTOS_SR): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [nombre, e] of Object.entries(EFECTOS)) out[nombre] = Math.round((analizarEfecto(e.generar(sr), sr).picoSamples / sr) * 1000) / 1000;
  return out;
}

/** Genera todos los efectos como WAV mono de 16 bits en `carpeta`; devuelve las rutas. */
export function generarEfectos(carpeta: string, sr: number = EFECTOS_SR): string[] {
  return Object.entries(EFECTOS).map(([nombre, e]) => {
    const ruta = join(carpeta, `${nombre}.wav`);
    escribirWav16(ruta, e.generar(sr), sr, 1);
    return ruta;
  });
}
