import { holdRender, releaseRender } from "../../engine";

/** `letterSpacing` en em: se suma al ancho de cada carácter (el canvas no lo mide, el DOM sí lo dibuja). */
export type FontSpec = { family: string; weight?: number; letterSpacing?: number };

const isJsdom = () => typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

let canvas: HTMLCanvasElement | null = null;
const ctx2d = (): CanvasRenderingContext2D | null => {
  if (typeof document === "undefined" || isJsdom()) return null;
  try {
    canvas ??= document.createElement("canvas");
    return canvas.getContext("2d");
  } catch {
    return null;
  }
};

let fontHold: number | null = null;
/** Si hay fuentes cargandose, frena la captura (holdRender) hasta que terminen. Idempotente. */
function holdForFonts(): void {
  if (typeof document === "undefined" || !document.fonts || fontHold !== null || document.fonts.status !== "loading") return;
  fontHold = holdRender("fx-text: fuentes");
  void document.fonts.ready.then(() => {
    if (fontHold !== null) releaseRender(fontHold);
    fontHold = null;
  });
}

/** Ancho relativo de un caracter (en em) para el respaldo sin navegador (jsdom): estimacion por clases de glifo. */
export function glyphWidthEm(ch: string): number {
  if (ch === " ") return 0.3;
  if ("iljtf.,;:!|'`".includes(ch)) return 0.3;
  if ("mwMW@%".includes(ch)) return 0.88;
  if (/[A-Z0-9]/.test(ch)) return 0.66;
  return 0.56;
}

/** Ancho en px de `text`. Con navegador mide con canvas (`measureText`); en jsdom estima por glifo. Suma `font.letterSpacing` (em) por carácter. */
export function measureWidth(text: string, fontSize: number, font: FontSpec): number {
  const spacing = (font.letterSpacing ?? 0) * fontSize * Array.from(text).length;
  const c = ctx2d();
  if (c) {
    holdForFonts();
    c.font = `${font.weight ?? 400} ${fontSize}px ${font.family}`;
    return c.measureText(text).width + spacing;
  }
  let w = 0;
  for (const ch of text) w += glyphWidthEm(ch);
  return w * fontSize + spacing;
}

export type FitOptions = { font: FontSpec; max: number; min?: number; measure?: (text: string, fontSize: number, font: FontSpec) => number };

/** Mayor tamano de letra (entre `min` y `max`) con el que `text` entra en `maxWidth` px en una sola linea. */
export function fitText(text: string, maxWidth: number, o: FitOptions): number {
  const min = o.min ?? 1;
  const probe = 100;
  const w = (o.measure ?? measureWidth)(text, probe, o.font);
  if (!(w > 0)) return o.max;
  return Math.max(min, Math.min(o.max, (maxWidth / w) * probe));
}
