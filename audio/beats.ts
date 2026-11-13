// Ayudas puras para que una escena caiga sobre el compás. Reciben la lista de cuadros de
// cada pulso (`beatFrames` del JSON que produce `tempo` o `empalme`) y no dependen de nada.
// Son funciones del número de cuadro, así que respetan la regla de determinismo.

/** Cuadros de cada pulso, ascendentes (pueden ser fraccionarios). */
export type Beats = readonly number[];

/** Posición continua en pulsos: 0 en el primer pulso, 1 en el segundo, 2,5 a mitad entre el tercero y el cuarto.
 *  Antes del primero y después del último extrapola con el intervalo vecino. Sin pulsos devuelve 0. */
export function beatAt(frame: number, beats: Beats): number {
  const n = beats.length;
  if (n < 2) return 0;
  if (frame <= beats[0]) return (frame - beats[0]) / (beats[1] - beats[0]);
  if (frame >= beats[n - 1]) return n - 1 + (frame - beats[n - 1]) / (beats[n - 1] - beats[n - 2]);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= frame) lo = mid;
    else hi = mid;
  }
  return lo + (frame - beats[lo]) / (beats[lo + 1] - beats[lo]);
}

/** Fase dentro del pulso actual, en [0, 1). */
export function beatPhase(frame: number, beats: Beats): number {
  const b = beatAt(frame, beats);
  return b - Math.floor(b);
}

/** Pulso más cercano: índice, cuadro y distancia en cuadros (con signo: positivo si el pulso está después). */
export function nearestBeat(frame: number, beats: Beats): { index: number; frame: number; distance: number } | null {
  if (beats.length === 0) return null;
  let best = 0;
  for (let i = 1; i < beats.length; i++) {
    if (Math.abs(beats[i] - frame) < Math.abs(beats[best] - frame)) best = i;
    else if (beats[i] > frame) break;
  }
  return { index: best, frame: beats[best], distance: beats[best] - frame };
}

/** Golpe que vale 1 justo en el pulso y decae hacia 0. `decay` es la fracción de pulso en la que
 *  cae a 1/e (0,25 = seco, 1 = suave). Antes del primer pulso vale 0. */
export function pulse(frame: number, beats: Beats, decay = 0.3): number {
  if (beats.length < 2 || frame < beats[0]) return 0;
  return Math.exp(-beatPhase(frame, beats) / Math.max(1e-6, decay));
}

/** Cuadros por pulso en el pulso actual (para escalar duraciones al tempo). */
export function framesPerBeat(frame: number, beats: Beats): number {
  const n = beats.length;
  if (n < 2) return 0;
  const i = Math.min(n - 2, Math.max(0, Math.floor(beatAt(frame, beats))));
  return beats[i + 1] - beats[i];
}
