export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function num(s: string): number {
  const t = s.trim();
  return t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
}

function parseHue(s: string): number {
  const m = /^(-?\d*\.?\d+(?:e-?\d+)?)(deg|grad|rad|turn)?$/.exec(s.trim());
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "grad": return n * 0.9;
    case "rad": return (n * 180) / Math.PI;
    case "turn": return n * 360;
    default: return n;
  }
}

/** Interpreta hex (3/4/6/8), rgb(a) y hsl(a). Devuelve null si no es válido. */
export function parseColor(input: string): RGBA | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.split("").map((x) => x + x).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  m = /^(rgba?|hsla?)\(\s*([^)]*)\)$/.exec(s);
  if (!m) return null;
  const parts = m[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const alpha = parts.length === 4 ? clamp(num(parts[3]), 0, 1) : 1;
  if (Number.isNaN(alpha)) return null;
  if (m[1].startsWith("rgb")) {
    const v = parts.slice(0, 3).map((p) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p)));
    if (v.some((x) => Number.isNaN(x))) return null;
    return { r: Math.round(clamp(v[0], 0, 255)), g: Math.round(clamp(v[1], 0, 255)), b: Math.round(clamp(v[2], 0, 255)), a: alpha };
  }
  const h = parseHue(parts[0]);
  const sat = num(parts[1]);
  const lig = num(parts[2]);
  if ([h, sat, lig].some((x) => Number.isNaN(x))) return null;
  const [r, g, b] = hslToRgb(h, clamp(sat, 0, 1), clamp(lig, 0, 1));
  return { r, g, b, a: alpha };
}

export function isValidColor(input: string): boolean {
  return parseColor(input) !== null;
}

export function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const h = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Devuelve h (0..360), s y l (0..1). */
export function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

export function fromHsl(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, clamp(s, 0, 1), clamp(l, 0, 1));
  return toHex({ r, g, b });
}

/** Variante de un color con el matiz rotado y la luminosidad ajustada. */
export function shiftColor(color: string, hueShift: number, lightShift = 0): string {
  const c = parseColor(color);
  if (!c) return color;
  const [h, s, l] = rgbToHsl(c);
  return fromHsl(h + hueShift, s, l + lightShift);
}

/** Aplica opacidad (0..1) a un color hex, rgb(a) o hsl(a); devuelve rgba(). Un color inválido se devuelve igual. */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  if (!c) return color;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${+a.toFixed(4)})`;
}

/**
 * Mezcla `a` hacia `b` en `t` (0..1) y devuelve hex (el alfa de los colores se ignora). Si alguno no es válido, devuelve `a`.
 * Sirve para superficies teñidas y para calcular el peor fondo bajo una superficie translúcida.
 */
export function mixColors(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return a;
  const k = Math.min(1, Math.max(0, t));
  return toHex({ r: ca.r + (cb.r - ca.r) * k, g: ca.g + (cb.g - ca.g) * k, b: ca.b + (cb.b - ca.b) * k });
}
