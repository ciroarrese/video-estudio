// Clic de mouse sintetizado: un modelo físico chico de un botón de mouse (microinterruptor bajo una carcasa
// de plástico). Todo es original y determinista (ruido con semilla), sin muestras de nadie.
//
// Un clic de mouse real son DOS eventos, bajada y subida del botón. Cada uno es:
//   1. un chasquido de banda ancha de 1 a 4 ms con ataque casi instantáneo (el contacto del interruptor),
//   2. el repiqueteo seco y muy amortiguado de la carcasa: varios modos inarmónicos entre 1,5 y 7 kHz que
//      se apagan en 5 a 20 ms (no hay tono musical),
//   3. casi nada por debajo de 300 Hz.
// La subida suele ser un poco más baja de nivel y más aguda que la bajada, y la separación entre ambas va
// de 70 a 130 ms. Pequeñas irregularidades de nivel, de tiempo y de frecuencia de los modos lo hacen sonar físico.
//
// Modelo: una ráfaga corta de ruido excita un banco de resonadores de dos polos (los modos de la carcasa) y
// se le suma un "tic" de banda ancha casi sin resonancia. No hay senoides con barrido ni tonos.

const TAU = 2 * Math.PI;

/** Ruido uniforme determinista (LCG de 32 bits), igual al de `efectos.ts`. */
function ruido(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

/** Pasabajos de un polo (en el lugar); `pasadas` lo aplica en cascada. */
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

/** Pasaaltos de un polo en cascada (en el lugar): saca el grave y la continua. */
function pasaAltos(x: Float32Array, sr: number, fc: number, pasadas = 1): Float32Array {
  for (let p = 0; p < pasadas; p++) {
    const bajos = pasaBajos(Float32Array.from(x), sr, fc);
    for (let i = 0; i < x.length; i++) x[i] -= bajos[i];
  }
  return x;
}

/** Pico de salida: unos -3 dBFS (el mismo que el resto de las variantes de clic). */
const PICO = 0.708;

/** Cómo suena un botón: los modos de la carcasa, el tic y la excitación. Los modos de la subida salen de los de la bajada. */
export interface PerfilMouse {
  /** Frecuencias de los modos de la carcasa (Hz), inarmónicas, de 1,5 a 7 kHz. */
  modos: number[];
  /** Amplitud relativa de cada modo. */
  amps: number[];
  /** Constante de tiempo de caída de cada modo (s): la energía cae 8,7 dB por constante. */
  taus: number[];
  /** Chasquido de banda ancha: frecuencia del pasaaltos (Hz), constante de caída (s), amplitud relativa al cuerpo y pasabajos opcional (Hz). */
  tic: { fc: number; tau: number; amp: number; lp?: number };
  /** Ráfaga de ruido que excita los modos: caída (s), subida (s) y pasabajos opcional (Hz) que le quita filo. */
  excitacion: { tau: number; ataque: number; lp?: number };
  /** Subida respecto de la bajada: nivel, escala de frecuencias, escala de caída, amplitud del tic y escala de su pasaaltos. */
  subida: { nivel: number; frecuencia: number; caida: number; tic: number; ticFc: number };
  /** Separación entre bajada y subida (ms). */
  separacionMs: number;
  /** Semilla del ruido. */
  semilla: number;
}

export const PERFILES: Record<string, PerfilMouse> = {
  // Mouse de oficina común: interruptor estándar, carcasa de plástico, subida más baja y más aguda.
  normal: {
    modos: [1730, 2480, 3410, 4630, 6240],
    amps: [0.55, 1, 0.85, 0.5, 0.3],
    taus: [0.0042, 0.0034, 0.0029, 0.0023, 0.0018],
    tic: { fc: 2200, tau: 0.0006, amp: 4 },
    excitacion: { tau: 0.0006, ataque: 0.00006 },
    subida: { nivel: 0.58, frecuencia: 1.09, caida: 0.8, tic: 2, ticFc: 1.9 },
    separacionMs: 95,
    semilla: 7001,
  },
  // Mouse silencioso: interruptor amortiguado; más sordo, menos agudos, ataque más blando y caída más larga.
  suave: {
    modos: [1380, 1950, 2640, 3480, 4700],
    amps: [0.6, 0.85, 0.8, 0.55, 0.3],
    taus: [0.0032, 0.0029, 0.0027, 0.0023, 0.0019],
    tic: { fc: 800, tau: 0.0009, amp: 1.0, lp: 4000 },
    excitacion: { tau: 0.0011, ataque: 0.0006, lp: 5200 },
    subida: { nivel: 0.5, frecuencia: 1.14, caida: 0.85, tic: 1.4, ticFc: 1.4 },
    separacionMs: 100,
    semilla: 7002,
  },
  // Microinterruptor mecánico marcado: más agudo y seco, chasquido fuerte y subida casi tan fuerte como la bajada.
  marcado: {
    modos: [2150, 3090, 4260, 5780, 7350],
    amps: [0.45, 0.9, 1, 0.8, 0.5],
    taus: [0.0032, 0.0027, 0.0023, 0.0018, 0.0014],
    tic: { fc: 3500, tau: 0.0005, amp: 6.5 },
    excitacion: { tau: 0.0005, ataque: 0.00004 },
    subida: { nivel: 1.08, frecuencia: 1.07, caida: 0.85, tic: 1.1, ticFc: 1.3 },
    separacionMs: 88,
    semilla: 7003,
  },
};

/** Un evento (bajada o subida): chasquido más banco de resonadores, sumado en `out` desde la muestra `i0`. */
function evento(out: Float32Array, sr: number, i0: number, p: PerfilMouse, nivel: number, escalaFrec: number, escalaCaida: number, escalaTic: number, escalaTicFc: number, azar: () => number, semilla: number): void {
  const n = Math.min(out.length - i0, Math.round(0.06 * sr));
  if (n <= 0) return;
  const r = ruido(semilla);
  // El evento se arma aparte y se suma al final con la energía que pide `nivel`: así el nivel de cada
  // chasquido no depende de cómo cayeron las fases de los modos ni las pocas muestras de ruido.
  const ev = new Float32Array(n);
  // Ráfaga de excitación.
  const m = Math.round(0.012 * sr);
  const exc = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const t = i / sr;
    exc[i] = r() * Math.exp(-t / p.excitacion.tau) * Math.min(1, t / p.excitacion.ataque);
  }
  if (p.excitacion.lp) pasaBajos(exc, sr, p.excitacion.lp, 2);
  // Energía fija: el nivel de cada evento lo decide `nivel`, no la suerte de las pocas muestras de ruido.
  let ee = 0;
  for (const v of exc) ee += v * v;
  const ge = ee > 0 ? 1 / Math.sqrt(ee / (0.0006 * sr)) : 1;
  for (let i = 0; i < m; i++) exc[i] *= ge;
  // Banco de resonadores de dos polos: y[n] = 2 R cos(w) y[n-1] - R^2 y[n-2] + g x[n]. Cada modo se desafina un poco al azar.
  for (let k = 0; k < p.modos.length; k++) {
    const f = Math.min(0.45 * sr, p.modos[k] * escalaFrec * (1 + 0.02 * azar()));
    const tau = p.taus[k] * escalaCaida * (1 + 0.08 * azar());
    const R = Math.exp(-1 / (tau * sr));
    const c1 = 2 * R * Math.cos((TAU * f) / sr);
    const c2 = -R * R;
    const g = p.amps[k] * Math.sqrt(1 - R * R) * 0.9;
    let y1 = 0;
    let y2 = 0;
    for (let i = 0; i < n; i++) {
      const y = c1 * y1 + c2 * y2 + (i < m ? g * exc[i] : 0);
      y2 = y1;
      y1 = y;
      ev[i] += y;
    }
  }
  // Tic de banda ancha: ruido con pasaaltos y caída de décimas de milisegundo (el contacto).
  const nt = Math.round(0.004 * sr);
  const tic = new Float32Array(nt);
  for (let i = 0; i < nt; i++) tic[i] = r() * Math.exp(-i / sr / p.tic.tau) * Math.min(1, i / sr / 0.00004);
  pasaAltos(tic, sr, p.tic.fc * escalaTicFc);
  if (p.tic.lp) pasaBajos(tic, sr, p.tic.lp, 2);
  let et = 0;
  for (const v of tic) et += v * v;
  const gt = et > 0 ? 1 / Math.sqrt(et / (0.0003 * sr)) : 1;
  for (let i = 0; i < nt; i++) tic[i] *= gt;
  for (let i = 0; i < nt && i < n; i++) ev[i] += p.tic.amp * escalaTic * 0.5 * tic[i];
  let ene = 0;
  for (const v of ev) ene += v * v;
  const gn = ene > 0 ? (nivel * 0.2) / Math.sqrt(ene / sr) : 0;
  for (let i = 0; i < n; i++) out[i0 + i] += gn * ev[i];
}

export interface OpcionesMouse {
  /** Si suena la subida del botón (por defecto sí). */
  subida?: boolean;
  /** Cantidad de clics completos (1 por defecto; 2 es un doble clic). */
  clics?: number;
  /** Separación entre el comienzo de un clic y el siguiente (ms) en un doble clic. */
  entreClicsMs?: number;
}

/**
 * Genera un clic de mouse mono: `perfil` elige el tipo de botón y `opts` si lleva subida y cuántos clics.
 * Pico cerca de -3 dBFS, primera y última muestra en cero y sin continua.
 */
export function generarMouse(sr: number, perfil: keyof typeof PERFILES, opts: OpcionesMouse = {}): Float32Array {
  const p = PERFILES[perfil];
  const clics = opts.clics ?? 1;
  const conSubida = opts.subida ?? true;
  const entre = (opts.entreClicsMs ?? 200) / 1000;
  const azar = ruido(p.semilla);
  const previo = 0.002; // silencio inicial: la primera muestra es cero
  const ultimo = (clics - 1) * entre + (conSubida ? p.separacionMs / 1000 : 0);
  const out = new Float32Array(Math.round((previo + ultimo + 0.07) * sr));
  for (let c = 0; c < clics; c++) {
    // Irregularidades: el segundo clic sale un poco distinto del primero (nivel y tiempo).
    const t0 = previo + c * entre + (c ? 0.003 * azar() : 0);
    const nivel = (1 + 0.07 * azar()) * (c ? 0.93 : 1);
    evento(out, sr, Math.round(t0 * sr), p, nivel, 1, 1, 1, 1, azar, p.semilla + 10 * c + 1);
    if (conSubida) {
      const sep = p.separacionMs / 1000 * (1 + 0.04 * azar());
      evento(out, sr, Math.round((t0 + sep) * sr), p, nivel * p.subida.nivel * (1 + 0.07 * azar()), p.subida.frecuencia, p.subida.caida, p.subida.tic, p.subida.ticFc, azar, p.semilla + 10 * c + 2);
    }
  }
  // Casi nada bajo 300 Hz: pasaaltos de 12 dB por octava en 450 Hz. Después, sin continua y con salida suave.
  pasaAltos(out, sr, 450, 2);
  let media = 0;
  for (const v of out) media += v;
  media /= out.length;
  const fo = Math.round(0.004 * sr);
  for (let i = 0; i < out.length; i++) {
    out[i] -= media;
    const resto = out.length - 1 - i;
    if (resto < fo) out[i] *= resto / fo;
  }
  out[0] = 0;
  out[out.length - 1] = 0;
  let mx = 0;
  for (const v of out) mx = Math.max(mx, Math.abs(v));
  const g = mx > 0 ? PICO / mx : 1;
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return out;
}
