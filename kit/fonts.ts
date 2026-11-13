import type { Theme } from "../themes";

/** Primer nombre de familia de una pila CSS, sin comillas: es el nombre que se usa en `@font-face`. */
export function firstFamily(stack: string): string {
  const m = /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/.exec(stack);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? stack).trim();
}

/** Reglas `@font-face` de los archivos locales de un tema (cadena vacía si no declara ninguno). */
export function fontFaceCss(theme: Theme): string {
  const face = firstFamily(theme.font.family);
  return (theme.font.files ?? [])
    .map((f) => `@font-face{font-family:${JSON.stringify(face)};font-weight:${f.weight};src:url(${JSON.stringify(f.src)});}`)
    .join("");
}
