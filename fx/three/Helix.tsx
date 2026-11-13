import { Easing, FrameCanvas, lerp, mix, sub } from "../core";
import { camera } from "./math";
import { flush, useThreeFx } from "./common";
import type { Prim, ThreeProps } from "./common";

export type HelixProps = ThreeProps & {
  /** Pasos a lo largo del eje (cada uno con un peldaño). */
  steps?: number;
  /** Vueltas completas. */
  turns?: number;
};

/** Doble hélice con peldaños; crece de abajo hacia arriba mientras gira. */
export function Helix(p: HelixProps) {
  const { t, width, height, pal, k, pen } = useThreeFx(p, { width: 700, height: 900, duration: 75 });
  const steps = p.steps ?? 44;
  const turns = p.turns ?? 2.5;
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const unit = Math.min(width * 0.46, height * 0.25);
        const H = 2.4; // alto total en unidades
        const R = 1;
        const grow = Easing.out(sub(t, 0, 0.7));
        const spin = lerp(-1.4, 0.9, Easing.out(t));
        const cam = camera({ distance: 6, tilt: 0.28, yaw: 0, unit });
        ctx.translate(width / 2, height / 2);
        pen.caps(ctx, { cap: true });
        const prims: Prim[] = [];
        const near = 4.5, far = 7.5;
        const at = (i: number, strand: 0 | 1) => {
          const u = i / steps;
          const a = u * turns * Math.PI * 2 + spin + strand * Math.PI;
          return cam.project({ x: Math.cos(a) * R, y: (u - 0.5) * H * 2 * 0.8, z: Math.sin(a) * R });
        };
        for (let i = 0; i <= steps; i++) {
          const rise = Easing.out(sub(grow, (i / steps) * 0.75, (i / steps) * 0.75 + 0.25));
          if (rise <= 0) continue;
          const A = at(i, 0), B = at(i, 1);
          const A1 = i < steps ? at(i + 1, 0) : null, B1 = i < steps ? at(i + 1, 1) : null;
          const nextRise = i < steps ? Easing.out(sub(grow, ((i + 1) / steps) * 0.75, ((i + 1) / steps) * 0.75 + 0.25)) : 0;
          // Peldaño.
          const dr = (A.depth + B.depth) / 2;
          const sr = pen.byDepth(dr, near, far, { minAlpha: 0.15, maxAlpha: 0.7, minWidth: 1 * k, maxWidth: 2.4 * k });
          prims.push({ depth: dr, draw: (c) => pen.seg(c, A.x, A.y, B.x, B.y, pen.quiet(pal.line), sr.alpha * rise, sr.width) });
          // Tramos de cada hebra.
          if (A1 && B1 && nextRise > 0) {
            for (const [P, Q, col, w] of [[A, A1, pal.accent, 1], [B, B1, pen.quiet(pal.ink), 1]] as const) {
              const d = (P.depth + Q.depth) / 2;
              const s = pen.byDepth(d, near, far, { minAlpha: 0.2, maxAlpha: 1, minWidth: 2 * k, maxWidth: 5.5 * k });
              prims.push({ depth: d, draw: (c) => pen.seg(c, P.x, P.y, Q.x, Q.y, col, s.alpha * Math.min(rise, nextRise) * w, s.width, { main: true }) });
            }
          }
          // Esferas en los nudos.
          for (const [P, col] of [[A, pen.soft], [B, pen.quiet(mix(pal.ink, pal.line, 0.2))]] as const) {
            const s = pen.byDepth(P.depth, near, far, { minAlpha: 0.3, maxAlpha: 1, minWidth: 3 * k, maxWidth: 8 * k });
            prims.push({ depth: P.depth - 0.01, draw: (c) => pen.dot(c, P.x, P.y, s.width * rise, col, s.alpha) });
          }
        }
        flush(ctx, prims);
      }}
    />
  );
}
