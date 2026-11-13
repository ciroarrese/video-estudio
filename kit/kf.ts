import { Easing, interpolate } from "../engine";
import type { EasingFn } from "../engine";

/**
 * Cuadros clave de un valor: `kf(frame, [0, 20, 40], [0, 1, 0.5])`.
 * Con clamp y easing por tramo (por defecto `Easing.inOut`). Una sola clave devuelve ese valor;
 * con 2 o más, `keys` debe ser estrictamente creciente (si no, lanza el error del motor).
 */
export function kf(frame: number, keys: number[], values: number[], easing: EasingFn = Easing.inOut): number {
  if (keys.length === 1 && values.length === 1) return values[0]!;
  return interpolate(frame, keys, values, { easing });
}

/**
 * Trayecto 2D por paradas `[cuadro, x, y]`; devuelve la posición en `frame`.
 * Una sola parada = posición fija. Sirve para el cursor y para cualquier cosa que viaja entre objetivos.
 */
export function track(
  frame: number,
  stops: [number, number, number][],
  easing: EasingFn = Easing.inOut,
): { x: number; y: number } {
  if (stops.length === 1) return { x: stops[0]![1], y: stops[0]![2] };
  const t = stops.map((s) => s[0]);
  return { x: kf(frame, t, stops.map((s) => s[1]), easing), y: kf(frame, t, stops.map((s) => s[2]), easing) };
}

/** Texto que se escribe a `charsPerFrame` caracteres por cuadro desde `start`. */
export function typed(text: string, frame: number, start: number, charsPerFrame = 1.4): string {
  return text.slice(0, Math.max(0, Math.floor((frame - start) * charsPerFrame)));
}
