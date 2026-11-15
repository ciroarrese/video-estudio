import type { FxBox } from "./types";

/**
 * Densidad de un efecto (`density` en las props): cuánto se achican sus tipografías, grosores y márgenes para que el efecto entre bien en una caja
 * más chica que la de diseño.
 * - sin `density` (por defecto): 1, el efecto de siempre (el aspecto de los videos ya hechos no cambia);
 * - un número: ese factor (0,25 a 2) sobre todas las medidas que no son del contenido;
 * - `"auto"`: se calcula de la caja que recibe el efecto (`width`/`height`) contra la caja de diseño del efecto, `min(ancho / ancho de diseño, alto / alto de
 *   diseño)`; nunca pasa de 1 (una caja grande no agranda el efecto), y no baja de 0,3.
 * Una caja chica sin `density` sigue dibujando con las medidas de diseño: el efecto se ve apretado o se recorta. Con `density="auto"` cada medida
 * (letra, trazo, relleno) se escala por el mismo factor y el efecto conserva sus proporciones.
 */
export type Density = "auto" | number;

export const DENSITY_MIN = 0.3;

/** Factor de escala de un efecto: ver `Density`. `design` es la caja para la que el efecto se diseñó (la de sus valores por defecto). */
export function fxDensity(density: Density | undefined, box: FxBox, design: FxBox): number {
  if (density === undefined) return 1;
  if (density === "auto") return Math.max(DENSITY_MIN, Math.min(1, box.width / design.width, box.height / design.height));
  return Math.min(2, Math.max(0.25, density));
}
