import { exitPower, resolveStyle } from "../themes";
import type { Theme } from "../themes";
import { zoomThrough } from "./camera";

/**
 * Salida de la cámara hacia la escena siguiente según el design system (`style.motion.exit`): con `dive` (por defecto) es el atravesado de siempre
 * (`zoomThrough`, potencia `native`, 40 a 70, con el foco deslizándose rápido al objetivo); con `settle`, un empuje suave (potencia 1,5) cuyo foco llega al
 * objetivo en todo el tramo, sin el tirón de un deslizamiento corto (que con la inclinación y el desenfoque de la cámara dejaba cuadros rotos). La
 * transición la hace el velo (`motion.transition`). Con el estilo por defecto devuelve exactamente lo que devuelve `zoomThrough` con `native`.
 *
 * ```ts
 * const cam = cameraAt(f, KEYS, { map: (fr, c) => exitThrough(theme, fr, T.through, c, target, 40), noBlurFrom: T.through[0] });
 * ```
 */
export function exitThrough(
  theme: Theme,
  frame: number,
  range: [number, number],
  cam: { x: number; y: number; scale: number },
  target: { x: number; y: number },
  native = 60,
): { x: number; y: number; scale: number } {
  const soft = resolveStyle(theme).motion.exit === "settle";
  return zoomThrough(frame, range, cam, target, exitPower(theme, native), soft ? { slide: range[1] - range[0] } : {});
}
