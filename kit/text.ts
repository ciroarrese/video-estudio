import { measureWidth } from "../fx/text/measure";
import { textStyle } from "../themes";
import type { Theme } from "../themes";

type WeightName = keyof Theme["font"]["weights"];

export interface TextWidthOptions {
  /** Tamaño de letra en px (por defecto `theme.type.body`). */
  size?: number;
  /** Peso: un número o un nombre de `theme.font.weights` (`regular`, `medium`, `semibold`, `stat`). Si falta, el del `role`, o `regular`. */
  weight?: number | WeightName;
  /** Rol de texto del design system (`title`, `label`, `eyebrow`, `caption`): aporta peso, interletrado y mayúsculas por `textStyle`. */
  role?: "title" | "label" | "eyebrow" | "caption";
}

/**
 * Ancho en px de `text` en una sola línea, con la tipografía del tema (`theme.font.family`) y el tratamiento del design system para el `role`
 * (peso, interletrado, mayúsculas). Sirve para maquetar por el ancho medido en vez de por píxeles fijos: el ancho de una pastilla, dónde cabe una
 * etiqueta, si un rótulo entra en una columna.
 *
 * Con navegador mide con canvas (`measureText`); sin navegador (jsdom) estima por clases de glifo. Es el mismo medidor que `fitText` de `fx/text`
 * (`kit/` lo envuelve: no duplica la medición ni espera las fuentes por su cuenta, eso lo hace `measureWidth`), así que da lo mismo en cada corrida.
 *
 * Límite: mide con la fuente del tema. Si la fuente real no carga (o una prueba de estrés la reemplaza), el texto puede ser más ancho que lo medido:
 * dejá un `minWidth` en lugar de un `width` fijo y un margen.
 */
export function textWidth(theme: Theme, text: string, opts: TextWidthOptions = {}): number {
  const size = opts.size ?? theme.type.body;
  const st = opts.role ? textStyle(theme, opts.role) : {};
  const w = opts.weight ?? (typeof st.fontWeight === "number" ? st.fontWeight : undefined) ?? "regular";
  const weight = typeof w === "number" ? w : theme.font.weights[w];
  const ls = typeof st.letterSpacing === "string" ? parseFloat(st.letterSpacing) : 0;
  const shown = st.textTransform === "uppercase" ? text.toUpperCase() : st.textTransform === "lowercase" ? text.toLowerCase() : text;
  return measureWidth(shown, size, { family: theme.font.family, weight, letterSpacing: Number.isFinite(ls) ? ls : 0 });
}
