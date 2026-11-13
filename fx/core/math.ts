import { Easing, random } from "../../engine";
import type { EasingFn } from "../../engine";
import { parseColor } from "../../themes";

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const hex2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");

/** Mezcla dos colores (hex, rgb(a), hsl(a)) con `t` en 0..1. Devuelve hex, o rgba() si hay transparencia. Si alguno no es valido devuelve `a`. */
export function mix(colorA: string, colorB: string, t: number): string {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  if (!a || !b) return colorA;
  const k = clamp(t);
  const r = lerp(a.r, b.r, k), g = lerp(a.g, b.g, k), bl = lerp(a.b, b.b, k), al = lerp(a.a, b.a, k);
  return al >= 0.9995 ? `#${hex2(r)}${hex2(g)}${hex2(bl)}` : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(bl)}, ${+al.toFixed(4)})`;
}

/** Progreso 0..1 (acotado) de `frame` en el tramo [start, start + duration], con easing opcional. Duracion <= 0 es un escalon. */
export function progress(frame: number, start: number, duration: number, easing?: EasingFn): number {
  if (duration <= 0) return frame >= start ? 1 : 0;
  const t = clamp((frame - start) / duration);
  return easing ? easing(t) : t;
}

/** Progreso (0..1) de varias fases `{at, dur}` (cuadros). Cada una puede solaparse con las otras. */
export function phases(frame: number, list: { at: number; dur: number; easing?: EasingFn }[]): number[] {
  return list.map((p) => progress(frame, p.at, p.dur, p.easing));
}

export type StaggerFrom = "start" | "end" | "center" | number;

/** Demora en cuadros del elemento `index` de un conjunto escalonado. `end` y `center` necesitan `total`. */
export function stagger(index: number, o: { each: number; from?: StaggerFrom; total?: number }): number {
  const from = o.from ?? "start";
  if (from === "start") return index * o.each;
  if (typeof from === "number") return Math.abs(index - from) * o.each;
  if (o.total === undefined) throw new Error(`stagger: from "${from}" needs total`);
  if (from === "end") return (o.total - 1 - index) * o.each;
  return Math.abs(index - (o.total - 1) / 2) * o.each;
}

/** Demora proporcional a una distancia (por ejemplo, la distancia al centro en px). */
export const staggerBy = (distance: number, perUnit: number): number => Math.abs(distance) * perUnit;

export type ClipOptions = { start: number; duration: number; holdAfter?: number };
export type ClipState = {
  /** Tiempo normalizado 0..1 del clip. */
  t: number;
  /** El clip ya llego a t = 1 (queda en el cuadro final compuesto). */
  done: boolean;
  /** Entre el inicio y el fin, contando la espera final. */
  active: boolean;
  /** Cuadro en el que termina la espera final (exclusivo). */
  end: number;
};

/** Mapea un cuadro a un tiempo normalizado t en [0,1]: se puede escribir toda la animacion sobre t. */
export function clip(frame: number, o: ClipOptions): ClipState {
  const t = progress(frame, o.start, o.duration);
  const end = o.start + o.duration + (o.holdAfter ?? 0);
  return { t, done: frame >= o.start + o.duration, active: frame >= o.start && frame < end, end };
}

/** Subtramo de t: `sub(t, a, b, easing?)` vale 0 antes de `a`, 1 despues de `b`. */
export function sub(t: number, a: number, b: number, easing?: EasingFn): number {
  return progress(t, a, b - a, easing);
}

/** Permutacion determinista de 0..n-1 (Fisher-Yates con `random`). */
export function seededShuffle(n: number, seed: string | number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random(`${seed}:shuffle:${i}`) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export { Easing };

// ---------- reposo: nada de transformaciones identidad y marcado independiente del historial ----------

const num = (n: number, d: number) => String(+n.toFixed(d));

/**
 * Transformación CSS con solo las partes que no son identidad (`undefined` si todas lo son). Sirve para emitir
 * `transform` solo mientras algo se anima: en reposo no queda `translateY(0px)`, `scale(1)` ni `rotate(0deg)`.
 * `x`/`y` en px, `scale`/`scaleX`/`scaleY` sin unidad, `rotate` en grados. `round` redondea los traslados a enteros.
 */
export function xform(o: { x?: number; y?: number; scale?: number; scaleX?: number; scaleY?: number; rotate?: number; round?: boolean }): string | undefined {
  const parts: string[] = [];
  const t = (v: number) => (o.round ? Math.round(v) : +v.toFixed(2));
  const x = t(o.x ?? 0), y = t(o.y ?? 0);
  if (x !== 0 && y !== 0) parts.push(`translate(${num(x, 2)}px, ${num(y, 2)}px)`);
  else if (x !== 0) parts.push(`translateX(${num(x, 2)}px)`);
  else if (y !== 0) parts.push(`translateY(${num(y, 2)}px)`);
  const sx = +(o.scaleX ?? o.scale ?? 1).toFixed(4), sy = +(o.scaleY ?? o.scale ?? 1).toFixed(4);
  if (sx !== 1 && sy !== 1 && sx === sy) parts.push(`scale(${num(sx, 4)})`);
  else {
    if (sx !== 1) parts.push(`scaleX(${num(sx, 4)})`);
    if (sy !== 1) parts.push(`scaleY(${num(sy, 4)})`);
  }
  const r = +(o.rotate ?? 0).toFixed(3);
  if (r !== 0) parts.push(`rotate(${num(r, 3)}deg)`);
  return parts.length ? parts.join(" ") : undefined;
}

/** Opacidad para emitir: `undefined` si es (casi) 1; así en reposo no queda `opacity: 0.999`. */
export const fade = (o: number): number | undefined => (o >= 0.9995 ? undefined : +Math.max(0, o).toFixed(4));

/**
 * Clave que cambia cuando cambia el CONJUNTO de propiedades definidas de un estilo (o de unas props).
 * Ponela como `key` del elemento: React, al sacar y volver a poner una propiedad, la agrega al final del atributo
 * `style` (o de los atributos), así que el HTML del mismo cuadro saldría distinto según el historial y
 * `checkDeterminism` fallaría. Con la clave, al cambiar el conjunto el elemento se vuelve a montar y el orden
 * es siempre el del objeto.
 */
export const styleKey = (o: object): string =>
  Object.entries(o).filter(([, v]) => v !== undefined && v !== false && v !== null).map(([k]) => k).join(",");

/** `transform` SVG de una escala alrededor de (cx, cy); `undefined` si la escala es 1 (sin residuo en reposo). */
export function svgScale(cx: number, cy: number, s: number): string | undefined {
  const k = +s.toFixed(4);
  return k === 1 ? undefined : `translate(${+cx.toFixed(2)} ${+cy.toFixed(2)}) scale(${k}) translate(${+(-cx).toFixed(2)} ${+(-cy).toFixed(2)})`;
}
