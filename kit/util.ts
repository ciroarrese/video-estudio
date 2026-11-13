import { Easing, bezier, useFrame } from "../engine";
import type { EasingFn } from "../engine";
import type { CubicBezier } from "../themes";

/** Devuelve el cuadro explícito si se pasó, o el del contexto del motor. */
export function useFrameOr(frame?: number): number {
  const ctx = useFrame();
  return frame ?? ctx;
}

/** Convierte una curva del tema (cubic-bezier) en una función de easing. */
export function themeEasing(c: CubicBezier): EasingFn {
  return bezier(c[0], c[1], c[2], c[3]);
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export { Easing };
