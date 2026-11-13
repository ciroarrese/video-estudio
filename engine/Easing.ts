// Provenance: written here from the math. Standard unit-bezier formulation
// (polynomial coefficients, Newton iterations, bisection fallback); no third-party source copied.
export type EasingFn = (t: number) => number;

/** Cubic-bezier easing (CSS semantics: P0=(0,0), P3=(1,1)). Own solver: Newton with bisection fallback. */
export function bezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new Error('bezier: x1 and x2 must be within [0, 1]');
  }
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sy = (s: number) => ((ay * s + by) * s + cy) * s;
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;

  const solve = (x: number): number => {
    // Newton
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(s) - x;
      if (Math.abs(err) < 1e-7) return s;
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    // Bisection fallback
    let lo = 0;
    let hi = 1;
    s = x;
    for (let i = 0; i < 60; i++) {
      const v = sx(s);
      if (Math.abs(v - x) < 1e-7) return s;
      if (v < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return s;
  };

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sy(solve(t));
  };
}

export const Easing = {
  linear: ((t) => t) as EasingFn,
  in: ((t) => t * t * t) as EasingFn,
  cubicIn: ((t) => t * t * t) as EasingFn,
  cubicOut: ((t) => 1 - Math.pow(1 - t, 3)) as EasingFn,
  cubicInOut: ((t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)) as EasingFn,
  bezier,
  /** Named preset: bezier(0.16, 1, 0.3, 1) */
  out: bezier(0.16, 1, 0.3, 1),
  /** Named preset: bezier(0.65, 0, 0.35, 1) */
  inOut: bezier(0.65, 0, 0.35, 1),
};
