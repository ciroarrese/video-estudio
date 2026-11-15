import type { Theme } from "../themes";
import { resolveAnnotationMark } from "../themes";

/**
 * Atributos `data-ve-*` con que las piezas que señalan algo se declaran al control de calidad (`qa`, regla `signal`): qué tipo de señal es, cuál es la
 * señal que el design system resuelve para ese tema y si la escena la forzó. No tienen efecto visual ni de layout; solo agregan atributos al marcado.
 * - `kind`: `callout` (la pieza del kit), `doodle` (los garabatos del kit) o `marker` (`MarkerDraw`).
 * - `piece`: nombre de la pieza (`DoodleArrow`, `DoodleCircle`, `DoodleUnderline`, `MarkerDraw`, `Callout`).
 * - `mark`: la señal que dibuja el tema (`resolveAnnotationMark`): `hand` si es de trazo a mano.
 * - `forced`: solo en un `Callout` con `variant` distinta de la del tema.
 */
export function signalAttrs(theme: Theme, kind: "callout" | "doodle" | "marker", piece: string, forced = false): Record<string, string | undefined> {
  return {
    "data-ve-signal": kind,
    "data-ve-piece": piece,
    "data-ve-mark": resolveAnnotationMark(theme),
    "data-ve-forced": forced ? "true" : undefined,
  };
}
