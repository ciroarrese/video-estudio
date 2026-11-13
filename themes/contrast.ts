import type { Theme } from "./types";
import { parseColor } from "./color";

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function lumOf(c: { r: number; g: number; b: number }): number {
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** Luminancia relativa WCAG (0..1); ignora el alfa. */
export function relativeLuminance(color: string): number {
  const c = parseColor(color);
  if (!c) throw new Error(`Color inválido: ${color}`);
  return lumOf(c);
}

type RGB = { r: number; g: number; b: number; a: number };
function over(fg: RGB, bg: RGB): RGB {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (f: number, b: number) => (f * fg.a + b * bg.a * (1 - fg.a)) / a;
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a };
}

/** Razón de contraste WCAG. Un fondo translúcido se compone sobre blanco y un texto translúcido sobre el fondo. */
export function contrastRatio(a: string, b: string): number {
  const fg = parseColor(a);
  const bg0 = parseColor(b);
  if (!fg) throw new Error(`Color inválido: ${a}`);
  if (!bg0) throw new Error(`Color inválido: ${b}`);
  const bg = over(bg0, { r: 255, g: 255, b: 255, a: 1 });
  const la = lumOf(over(fg, bg));
  const lb = lumOf(bg);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastWarning {
  pair: string;
  ratio: number;
  required: number;
  message: string;
}

/** Texto normal exige 4.5; tipografía grande (>=24px bold / 32px) exige 3. */
export function checkTheme(theme: Theme): ContrastWarning[] {
  const out: ContrastWarning[] = [];
  const check = (pair: string, fg: string, bg: string, required: number) => {
    let ratio: number;
    try {
      ratio = contrastRatio(fg, bg);
    } catch {
      out.push({ pair, ratio: 0, required, message: `${pair}: color inválido` });
      return;
    }
    if (ratio < required) {
      out.push({
        pair,
        ratio,
        required,
        message: `${pair}: contraste ${ratio.toFixed(2)}:1, mínimo ${required}:1`,
      });
    }
  };
  const c = theme.color;
  check("text/bg", c.text, c.bg, 4.5);
  check("textMuted/bg", c.textMuted, c.bg, 4.5);
  check("onAccent/accent", c.onAccent, c.accent, 4.5);
  return out;
}
