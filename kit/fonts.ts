import type { Theme, ThemeFontFile } from "../themes";

/** Primer nombre de familia de una pila CSS, sin comillas: es el nombre que se usa en `@font-face`. */
export function firstFamily(stack: string): string {
  const m = /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/.exec(stack);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? stack).trim();
}

/** Reglas `@font-face` de los archivos locales de un tema (cadena vacía si no declara ninguno). */
export function fontFaceCss(theme: Theme): string {
  return fontFaces(theme)
    .map(({ face, file: f }) => `@font-face{font-family:${JSON.stringify(face)};font-weight:${f.weight};src:url(${JSON.stringify(f.src)});}`)
    .join("");
}

/** Archivos locales del tema con la familia a la que pertenecen: los de `font.family` y los de `font.display` (si declara `displayFiles`). */
export function fontFaces(theme: Theme): { face: string; file: ThemeFontFile }[] {
  const text = firstFamily(theme.font.family);
  const out = (theme.font.files ?? []).map((file) => ({ face: text, file }));
  if (theme.font.display && theme.font.displayFiles?.length) {
    const title = firstFamily(theme.font.display);
    for (const file of theme.font.displayFiles) out.push({ face: title, file });
  }
  return out;
}
