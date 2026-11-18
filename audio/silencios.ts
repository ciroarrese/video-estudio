// Silencios de una señal mono: tramos donde el nivel (RMS en bloques de 10 ms) queda bajo un umbral. Núcleo puro.

export interface TramoSilencio {
  desde: number;
  hasta: number;
}

export interface OpcionesSilencios {
  /** Nivel (dBFS de RMS) bajo el cual hay silencio; -50 por defecto. */
  umbralDb?: number;
  /** Silencios más cortos que esto (s) no se informan; 0,3 por defecto. */
  minSec?: number;
  /** Largo del bloque en ms; 10 por defecto. */
  bloqueMs?: number;
}

/** Nivel RMS (dBFS) en bloques consecutivos de `bloqueMs`. */
export function nivelesPorBloque(x: Float32Array, sr: number, bloqueMs = 10): { db: Float32Array; bloque: number } {
  const bloque = Math.max(1, Math.round((bloqueMs / 1000) * sr));
  const nb = Math.ceil(x.length / bloque);
  const db = new Float32Array(nb);
  for (let b = 0; b < nb; b++) {
    const ini = b * bloque;
    const fin = Math.min(x.length, ini + bloque);
    let e = 0;
    for (let i = ini; i < fin; i++) e += x[i]! * x[i]!;
    const rms = Math.sqrt(e / Math.max(1, fin - ini));
    db[b] = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  }
  return { db, bloque };
}

/** Todos los silencios de la señal (incluidos el del comienzo y el del final si los hay), en segundos, de más de `minSec`. */
export function silenciosDe(x: Float32Array, sr: number, o: OpcionesSilencios = {}): TramoSilencio[] {
  const umbral = o.umbralDb ?? -50;
  const min = o.minSec ?? 0.3;
  const { db, bloque } = nivelesPorBloque(x, sr, o.bloqueMs);
  const out: TramoSilencio[] = [];
  let ini = -1;
  const cerrar = (finBloque: number) => {
    const d = (ini * bloque) / sr;
    const h = Math.min(x.length, finBloque * bloque) / sr;
    if (h - d >= min) out.push({ desde: d, hasta: h });
    ini = -1;
  };
  for (let b = 0; b < db.length; b++) {
    if (db[b]! < umbral) {
      if (ini < 0) ini = b;
    } else if (ini >= 0) cerrar(b);
  }
  if (ini >= 0) cerrar(db.length);
  return out;
}

/** Los silencios de `silenciosDe` que quedan ENTRE sonido y sonido (sin el del comienzo ni el de la cola final). */
export function silenciosInternos(x: Float32Array, sr: number, o: OpcionesSilencios = {}): TramoSilencio[] {
  const dur = x.length / sr;
  return silenciosDe(x, sr, o).filter((t) => t.desde > 1e-6 && t.hasta < dur - 1e-6);
}
