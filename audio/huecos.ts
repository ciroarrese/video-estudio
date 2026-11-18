// Huecos de la música: tramos donde la música tiene que callarse (o bajar) porque otra cosa suena sola, por ejemplo una escena con audio propio.
// Núcleo puro: arma una curva de ganancia mono que se multiplica contra la música. Es de fase cero y determinista.

export interface HuecoMusica {
  /** Segundo del video donde la música ya llegó al nivel del hueco (la bajada termina acá). */
  desdeSec: number;
  /** Segundo donde la música vuelve a subir (la subida empieza acá). Sin esto, o si pasa del final del video, la música no vuelve. */
  hastaSec?: number;
  /** Duración (s) de la bajada y de la subida; 0,8 por defecto. La bajada ocupa los `fadeSec` anteriores a `desdeSec`. */
  fadeSec?: number;
  /** Cuánto baja (dB, positivo) dentro del hueco; sin esto la música se calla del todo. */
  bajaDb?: number;
}

export const FADE_HUECO_POR_DEFECTO = 0.8;

/**
 * Curva de ganancia lineal (mono, `totalSamples` muestras) que lleva la música de 1 al nivel del hueco con una rampa de coseno que termina en
 * `desdeSec`, la sostiene hasta `hastaSec` y la devuelve a 1 con otra rampa del mismo largo. Con huecos solapados manda el más profundo.
 */
export function curvaDeHuecos(huecos: readonly HuecoMusica[], totalSamples: number, sr: number): Float32Array {
  const curva = new Float32Array(totalSamples).fill(1);
  for (const h of huecos) {
    if (!(h.desdeSec >= 0)) throw new Error(`Hueco de música con desdeSec inválido: ${h.desdeSec}`);
    if (h.hastaSec !== undefined && !(h.hastaSec > h.desdeSec)) throw new Error(`Hueco de música: hastaSec (${h.hastaSec}) tiene que ser mayor que desdeSec (${h.desdeSec})`);
    if (h.bajaDb !== undefined && !(h.bajaDb > 0)) throw new Error(`Hueco de música: bajaDb tiene que ser mayor que 0 (recibió ${h.bajaDb})`);
    const fade = Math.max(1, Math.round((h.fadeSec ?? FADE_HUECO_POR_DEFECTO) * sr));
    const objetivo = h.bajaDb === undefined ? 0 : Math.pow(10, -h.bajaDb / 20);
    const ini = Math.min(totalSamples, Math.round(h.desdeSec * sr));
    const fin = h.hastaSec === undefined ? Infinity : Math.round(h.hastaSec * sr);
    const desde = Math.max(0, ini - fade);
    const hasta = Number.isFinite(fin) ? Math.min(totalSamples, fin + fade) : totalSamples;
    for (let i = desde; i < hasta; i++) {
      let u: number; // 0 = música normal, 1 = al nivel del hueco
      if (i < ini) u = 0.5 - 0.5 * Math.cos((Math.PI * (i - (ini - fade) + 1)) / (fade + 1));
      else if (i < fin) u = 1;
      else u = 0.5 + 0.5 * Math.cos((Math.PI * (i - fin + 1)) / (fade + 1));
      const g = 1 + (objetivo - 1) * u;
      if (g < curva[i]!) curva[i] = g;
    }
  }
  return curva;
}
