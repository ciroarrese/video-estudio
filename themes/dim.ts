import { contrastRatio } from "./contrast";
import { mixColors, parseColor } from "./color";
import { resolveColor } from "./data";
import type { Theme } from "./types";

/** Opciones de `dimOpacity` y `dimmedColor`. */
export interface DimOptions {
  /** Contraste mínimo (WCAG) que tiene que conservar el texto atenuado contra el fondo. Por defecto 3 (el piso de `qa`: por debajo es error). Para texto chico, 4.5. */
  min?: number;
  /** Opacidad mínima aceptable (0 a 1). Por defecto 0. Sirve para que la atenuación nunca quede más débil que un valor decidido. */
  floor?: number;
}

/**
 * La opacidad **más baja** (la atenuación más fuerte) con la que el color `fg` todavía llega a `min` de contraste contra `bg`.
 * Mide el color ya mezclado con el fondo, que es lo que se ve (no el color original): un gris al 50 % sobre claro no es el gris
 * al 100 %. Si ni con opacidad 1 llega (el color ya es flojo contra ese fondo), devuelve 1: no se atenúa. Es una función pura:
 * recorre pasos de 0,01 y devuelve el primero que cumple, así que da lo mismo en cualquier corrida.
 *
 * ```ts
 * const op = dimOpacity(theme.color.text, theme.color.surface);          // texto de una tarjeta que pasa a segundo plano
 * <div style={{ opacity: lerp(1, op, foco) }}>...</div>
 * ```
 *
 * Una `opacity` fija menor que 0,5 sobre texto es un defecto latente: con otro design system (otro fondo, otro color de texto) el
 * contraste cae bajo 3 y `qa` lo marca. Para atenuar texto usá esta función o `dimmedColor`, que devuelve el color ya mezclado.
 */
export function dimOpacity(fg: string, bg: string, opts: DimOptions = {}): number {
  const min = opts.min ?? 3;
  const floor = Math.min(1, Math.max(0, opts.floor ?? 0));
  if (!parseColor(fg)) throw new Error(`dimOpacity: color inválido "${fg}"`);
  if (!parseColor(bg)) throw new Error(`dimOpacity: fondo inválido "${bg}"`);
  const start = Math.ceil(floor * 100);
  for (let i = start; i <= 100; i++) {
    const a = i / 100;
    if (contrastRatio(mixColors(bg, fg, a), bg) >= min) return a;
  }
  return 1;
}

/**
 * El color atenuado de `fg` (un rol del tema, `chart[n]`, `data.<nombre>` o un color ya sacado del tema) sobre el fondo `bg` (ídem):
 * el color opaco más tenue que todavía llega a `min` de contraste (3 por defecto). Se usa como `color` del texto, sin `opacity`,
 * así el texto no queda a medias con ningún fondo.
 *
 * ```ts
 * <span style={{ color: dimmedColor(theme, "text", theme.color.surface) }}>detalle de segundo plano</span>
 * ```
 */
export function dimmedColor(theme: Theme, fg: string, bg: string, opts: DimOptions = {}): string {
  const f = resolveColor(theme, fg);
  const b = resolveColor(theme, bg);
  return mixColors(b, f, dimOpacity(f, b, opts));
}
