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

/** Filtro pasabajos de un polo (suaviza los agudos); `pasadas` lo aplica en cascada para una caída más empinada. */
function pasaBajos(x: Float32Array, sr: number, fc: number, pasadas = 1): Float32Array {
  const a = 1 - Math.exp((-TAU * fc) / sr);
  for (let p = 0; p < pasadas; p++) {
    let y = 0;
    for (let i = 0; i < x.length; i++) {
      y += a * (x[i] - y);
      x[i] = y;
    }
  }
  return x;
}

/** Filtro pasaaltos de un polo (saca el grave y la continua). */
function pasaAltos(x: Float32Array, sr: number, fc: number): Float32Array {
  const bajos = pasaBajos(Float32Array.from(x), sr, fc);
  for (let i = 0; i < x.length; i++) x[i] -= bajos[i];
  return x;
}

/** Ataque corto en rampa (evita el chasquido de un arranque en seco) por el tiempo `seg`. */
const ataque = (t: number, seg: number) => Math.min(1, t / seg);

/** Pico de los clics alternativos: unos -3 dBFS. */
const PICO_CLIC = 0.708;

export interface Clic {
  descripcion: string;
  /** Cuándo conviene (una línea). */
  cuando: string;
  generar: Gen;
}

/**
 * Variantes del clic de interfaz. Cada una es un sonido distinto (no el mismo con otro filtro): todas
 * sintetizadas con fórmulas propias, mono, de 15 a 120 ms, con pico cerca de -3 dBFS. `actual` es el `clic`
 * original (el que se escribe como `clic` si no se elige otro con `efectos --clic <nombre>`).
 */
export const CLICS: Record<string, Clic> = {
  actual: {
    descripcion: 'El clic de siempre: chasquido agudo y seco sobre un cuerpo resonante corto.',
    cuando: 'Referencia; sirve para música con mucha percusión que lo tape.',
    generar: EFECTOS.clic.generar,
  },
  suave: {
    descripcion: 'Toque táctil suave: golpecito de graves y medios, casi sin agudos y sin resonancia.',
    cuando: 'Interfaces calmas y música tranquila; no cansa si se repite mucho.',
    generar: (sr) => {
      const x = buf(sr, 0.035);
      const tic = pasaBajos(ruidoBanda(x.length, sr, 11, () => 2600, 0.7), sr, 4000);
      for (let i = 0; i < x.length; i++) {
        const t = i / sr;
        const f = 280 + 140 * Math.exp(-t / 0.005);
        x[i] = 1 * Math.sin(TAU * f * t) * Math.exp(-t / 0.006) * ataque(t, 0.0008) + 0.3 * tic[i] * Math.exp(-t / 0.0012);
      }
      return terminar(x, sr, PICO_CLIC);
    },
  },
  mecanico: {
    descripcion: 'Interruptor mecánico: dos golpes secos, el de bajada y, 55 ms después, uno más chico de subida.',
    cuando: 'Botones y interruptores con peso; da sensación de objeto físico.',
    generar: (sr) => {
      const x = buf(sr, 0.095);
      const ruidoBaja = ruidoBanda(x.length, sr, 21, () => 3200, 0.9);
      const ruidoSube = ruidoBanda(x.length, sr, 22, () => 4200, 0.9);
      const i1 = Math.round(0.055 * sr);
      for (let i = 0; i < x.length; i++) {
        const t = i / sr;
        x[i] += 0.9 * ruidoBaja[i] * Math.exp(-t / 0.0015) + 0.5 * Math.sin(TAU * 1500 * t) * Math.exp(-t / 0.004) + 0.35 * Math.sin(TAU * 420 * t) * Math.exp(-t / 0.006);
        if (i >= i1) {
          const u = (i - i1) / sr;
          x[i] += 0.55 * ruidoSube[i] * Math.exp(-u / 0.001) + 0.28 * Math.sin(TAU * 1900 * u) * Math.exp(-u / 0.003);
        }
      }
      return terminar(x, sr, PICO_CLIC);
    },
  },
  madera: {
    descripcion: 'Golpe de madera: toc afinado cerca de 1 kHz que se apaga rápido, con un segundo parcial inarmónico.',
    cuando: 'Interfaces cálidas, artesanales o didácticas; combina con guitarras y teclados.',
    generar: (sr) => {
      const x = buf(sr, 0.07);
      nota(x, sr, 0, 1150, 0.009, 1, [[1, 1], [2.45, 0.5, 0.5], [4.1, 0.2, 0.25]]);
      const tic = pasaBajos(ruidoBanda(x.length, sr, 31, () => 2400, 0.8), sr, 5000);
      for (let i = 0; i < x.length; i++) x[i] += 0.35 * tic[i] * Math.exp(-i / sr / 0.0015);
      return terminar(x, sr, PICO_CLIC);
    },
  },
  cristal: {
    descripcion: 'Toque de cristal: tic brillante y muy corto con una resonancia fina que queda un instante.',
    cuando: 'Interfaces limpias y modernas; ojo, es el más agudo, mejor con música mullida.',
    generar: (sr) => {
      const x = buf(sr, 0.11);
      // Parciales inarmónicos entre 2,4 y 5,6 kHz (nada por encima, para que no sea estridente).
      nota(x, sr, 0, 2450, 0.03, 1, [[1, 1], [1.62, 0.7, 0.8], [2.31, 0.35, 0.5]]);
      const tic = ruidoBanda(x.length, sr, 41, () => 4000, 0.9);
      for (let i = 0; i < x.length; i++) x[i] += 0.3 * tic[i] * Math.exp(-i / sr / 0.0007);
      pasaBajos(x, sr, 7000);
      return terminar(x, sr, PICO_CLIC);
    },
  },
  burbuja: {
    descripcion: 'Burbuja: soplido redondo cuyo tono baja rápido de unos 900 a 350 Hz.',
    cuando: 'Interfaces amables o lúdicas; funciona bien para abrir, seleccionar o tildar.',
    generar: (sr) => {
      const x = buf(sr, 0.075);
      let fase = 0;
      for (let i = 0; i < x.length; i++) {
        const t = i / sr;
        fase += (TAU * (350 + 550 * Math.exp(-t / 0.014))) / sr;
        x[i] = (Math.sin(fase) + 0.18 * Math.sin(2 * fase)) * Math.exp(-t / 0.02) * ataque(t, 0.002);
      }
      return terminar(x, sr, PICO_CLIC);
    },
  },
  digital: {
    descripcion: 'Blip digital suave: triángulo cerca de 1 kHz con ataque y caída rápidos, filtrado para que no tenga filo.',
    cuando: 'Interfaces de software y música lo-fi: se siente electrónico pero amable.',
    generar: (sr) => {
      const x = buf(sr, 0.09);
      for (let i = 0; i < x.length; i++) {
        const t = i / sr;
        const ciclo = (t * 1040) % 1;
        const tri = 4 * Math.abs(ciclo - 0.5) - 1;
        x[i] = (tri + 0.25 * Math.sin(TAU * 2080 * t)) * Math.exp(-t / 0.011) * ataque(t, 0.0025);
      }
      pasaBajos(x, sr, 3200, 2);
      return terminar(x, sr, PICO_CLIC);
    },
  },
  thock: {
    descripcion: 'Tecla amortiguada ("thock"): golpe grave y cálido (cuerpo cerca de 180 Hz y un hueco a 420 Hz).',
    cuando: 'Teclados, escritura, listas y formularios; es el más grave y cálido.',
    generar: (sr) => {
      const x = buf(sr, 0.1);
      const golpe = pasaBajos(ruidoBanda(x.length, sr, 51, () => 1100, 0.7), sr, 1800);
      for (let i = 0; i < x.length; i++) {
        const t = i / sr;
        const f = 175 + 60 * Math.exp(-t / 0.012);
        x[i] = 0.4 * Math.sin(TAU * f * t) * Math.exp(-t / 0.026) * ataque(t, 0.0007) + 0.7 * Math.sin(TAU * 420 * t) * Math.exp(-t / 0.014) + 0.7 * golpe[i] * Math.exp(-t / 0.006);
      }
      return terminar(x, sr, PICO_CLIC);
    },
  },
  cinta: {
    descripcion: 'Clic de cinta: ráfaga acotada en banda, con un poco de saturación y sin agudos ni graves extremos.',
    cuando: 'Música lo-fi cálida: se mezcla con el grano de la música en lugar de destacar.',
    generar: (sr) => {
      const x = buf(sr, 0.06);
      const r = ruidoBanda(x.length, sr, 61, () => 1300, 0.9);
      for (let i = 0; i < x.length; i++) {
        const t = i / sr;
        x[i] = 1.6 * r[i] * Math.exp(-t / 0.0035) + 0.9 * Math.sin(TAU * 520 * t) * Math.exp(-t / 0.008) * ataque(t, 0.0006);
        x[i] = Math.tanh(1.8 * x[i]);
      }
      pasaBajos(x, sr, 2800);
      pasaAltos(x, sr, 260);
      return terminar(x, sr, PICO_CLIC);
    },
  },
};

/** Nombre de archivo de una variante: `clic-<nombre>`. */
export const nombreDeClic = (n: string) => `clic-${n}`;

/** Nombre de la variante que se escribe como `clic` si no se pide otra. */
export const CLIC_POR_DEFECTO = 'actual';

/** Variante de clic por nombre (error claro si no existe). */
export function elegirClic(nombre: string): Clic {
  const c = CLICS[nombre];
  if (!c) throw new Error(`No hay un clic "${nombre}"; las opciones son: ${Object.keys(CLICS).join(', ')}`);
  return c;
}

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

/**
 * Genera todos los efectos como WAV mono de 16 bits en `carpeta`; devuelve las rutas. Además de `clic` escribe
 * `clic-<nombre>` por cada variante de `CLICS`. Con `clic` se elige cuál variante se escribe como `clic` a secas
 * (por defecto `actual`, el original).
 */
export function generarEfectos(carpeta: string, sr: number = EFECTOS_SR, opts: { clic?: string } = {}): string[] {
  const elegido = elegirClic(opts.clic ?? CLIC_POR_DEFECTO);
  const rutas = Object.entries(EFECTOS).map(([nombre, e]) => {
    const ruta = join(carpeta, `${nombre}.wav`);
    escribirWav16(ruta, (nombre === 'clic' ? elegido : e).generar(sr), sr, 1);
    return ruta;
  });
  for (const [n, c] of Object.entries(CLICS)) {
    const ruta = join(carpeta, `${nombreDeClic(n)}.wav`);
    escribirWav16(ruta, c.generar(sr), sr, 1);
    rutas.push(ruta);
  }
  return rutas;
}
