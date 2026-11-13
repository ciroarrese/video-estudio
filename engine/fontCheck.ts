// Fuentes que no cargaron. Una fuente que falla (URL que da 404, archivo corrupto, familia sin `@font-face`) no rompe nada
// a la vista: el navegador cae a la fuente siguiente de la pila y el video sale con otra tipografía. Para que eso no pase
// callado, quien pide una fuente (`ThemeScope`) informa la falla acá y el runtime la convierte en un error de render
// (`checkFontFailures`), salvo en modo borrador (`?fonts=warn`, que pone `--allow-missing-fonts` / `VE_ALLOW_MISSING_FONTS=1`).

export type FontFailure = { family: string; /** URL del archivo, si se conoce. */ url: string | null; weight?: number | string; reason: string };

const failures = new Map<string, FontFailure>();

/** Anota una fuente que no cargó (idempotente: la clave es familia + peso + URL). */
export function reportFontFailure(f: FontFailure): void {
  failures.set(`${f.family}|${f.weight ?? ''}|${f.url ?? ''}`, f);
}

export const fontFailures = (): FontFailure[] => [...failures.values()];
export const clearFontFailures = (): void => failures.clear();

/** Mensaje que nombra la familia, el peso y la URL de cada fuente fallida. */
export function describeFontFailures(list: FontFailure[], allowHint = true): string {
  const lines = list.map((f) => `  - "${f.family}"${f.weight !== undefined ? ` (peso ${f.weight})` : ''}${f.url ? ` desde ${f.url}` : ''}: ${f.reason}`);
  return `${list.length === 1 ? 'No cargó una fuente' : `No cargaron ${list.length} fuentes`}; el video saldría con otra tipografía:\n${lines.join('\n')}\nRevisá la ruta (\`import f from "./x.otf?url"\` o \`asset("fonts/x.otf")\` con --assets / <VE_VIDEOS_DIR>/assets).${allowHint ? ' Para un borrador: --allow-missing-fonts (o VE_ALLOW_MISSING_FONTS=1).' : ''}`;
}

type FaceLike = { family: string; status: string };
type FontsLike = { forEach(cb: (f: FaceLike) => void): void };

/**
 * Fallas conocidas más las fuentes de `document.fonts` en estado `error` (de cualquier `@font-face`, no solo las del tema).
 * Devuelve la lista (vacía si todo cargó); no lanza.
 */
export function collectFontFailures(fonts: FontsLike | null | undefined = typeof document === 'undefined' ? null : ((document as unknown as { fonts?: FontsLike }).fonts ?? null)): FontFailure[] {
  const out = new Map(failures);
  const known = new Set([...failures.values()].map((f) => f.family));
  fonts?.forEach((f) => {
    const family = f.family.replace(/^["']|["']$/g, '');
    if (f.status === 'error' && !known.has(family)) out.set(`doc|${family}`, { family, url: null, reason: 'el navegador no pudo cargar el archivo (estado "error"; ¿404 o archivo dañado?)' });
  });
  return [...out.values()];
}

let warned = false;

/**
 * Llamar cuando ya no quedan cargas pendientes. Con `allow` (borrador) solo avisa por consola, una vez; si no, lanza un error
 * que nombra familia y URL de cada fuente fallida.
 */
export function checkFontFailures(allow: boolean): void {
  const list = collectFontFailures();
  if (!list.length) return;
  if (allow) {
    if (!warned) {
      warned = true;
      console.warn(`aviso: ${describeFontFailures(list, false)}`);
    }
    return;
  }
  throw new Error(describeFontFailures(list));
}
