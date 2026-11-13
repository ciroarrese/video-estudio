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
