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

/** Multiplica `x` por una caída lineal en dB: desde `desdeSec`, durante `durSec`, hasta `dbFinal`; después, silencio relativo constante. */
export function conCaidaEnDb(x: Float32Array, sr: number, desdeSec: number, durSec: number, dbFinal = -60): Float32Array {
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const u = Math.min(1, Math.max(0, (i / sr - desdeSec) / durSec));
    y[i] = x[i] * Math.pow(10, (dbFinal * u) / 20);
  }
  return y;
}

/** Ruido determinista (LCG) en [-1, 1]. */
export function ruidoDeterminista(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

/**
 * Patrón de batería sintético: bombo (golpe grave con un clic corto) sobre cada pulso y platillos
 * (ruido agudo) sobre cada corchea, a propósito más fuertes que el bombo: sobre el pulso y sobre
 * el contratiempo suenan iguales, así que solo el grave distingue cuál es el pulso. Mono.
 * `offsetSec` es el segundo del primer pulso.
 */
export function pistaDeBateria(o: { bpm: number; seconds: number; sr: number; offsetSec?: number; bombo?: number; platillo?: number }): Float32Array {
  const { bpm, seconds, sr, offsetSec = 0.1, bombo = 0.5, platillo = 0.45 } = o;
  const x = new Float32Array(Math.round(seconds * sr));
  const per = 60 / bpm;
  const r = ruidoDeterminista(11);
  let prev = 0;
  const hat = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const v = r();
    hat[i] = v - prev; // pasa-altos de un polo: ruido agudo
    prev = v;
  }
  for (let k = 0; offsetSec + (k * per) / 2 < seconds - 0.2; k++) {
    const i0 = Math.round((offsetSec + (k * per) / 2) * sr);
    for (let j = 0; j < 0.04 * sr && i0 + j < x.length; j++) x[i0 + j] += platillo * hat[i0 + j] * Math.exp(-j / sr / 0.01);
    if (k % 2 === 0) {
      for (let j = 0; j < 0.25 * sr && i0 + j < x.length; j++) {
        const t = j / sr;
        x[i0 + j] += bombo * Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-t / 0.03)) * t) * Math.exp(-t / 0.09);
      }
    }
  }
  return x;
}
