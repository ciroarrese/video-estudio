import { Easing, FrameCanvas, lerp, mix, progress, sub } from "../core";
import { camera, lineByDepth, rotateXYZ } from "./math";
import type { Vec3 } from "./math";
import { dot, flush, seg, useThreeFx } from "./common";
import type { Prim, ThreeProps } from "./common";

export type OrbitRingsProps = ThreeProps & {
  /** Cantidad de anillos (1 a 5). */
  rings?: number;
};

/** Esfera central con anillos inclinados y satélites que los recorren; los anillos pasan por detrás y por delante. */
export function OrbitRings(p: OrbitRingsProps) {
  const { local, t, width, height, pal } = useThreeFx(p, { width: 900, height: 900, duration: 75 });
  const n = Math.max(1, Math.min(5, p.rings ?? 3));
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const unit = Math.min(width, height) * 0.2;
        const D = 7;
        const cam = camera({ distance: D, tilt: 0.45, yaw: lerp(-0.5, 0.35, Easing.out(t)), unit });
        ctx.translate(width / 2, height / 2);
        ctx.lineCap = "round";
        const near = D - 2.6, far = D + 2.6;
        const prims: Prim[] = [];
        const grow = Easing.lands(progress(local, 0, 24));
        // Esfera central (sombreada con un degradado radial simple).
        const c0 = cam.project({ x: 0, y: 0, z: 0 });
        prims.push({
          depth: c0.depth,
          draw: (c) => {
            const r = 0.8 * unit * grow;
            const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
            g.addColorStop(0, mix(pal.accent, pal.lightest, 0.35));
            g.addColorStop(1, mix(pal.accent, pal.darkest, 0.55));
            c.fillStyle = g;
            c.beginPath();
            c.arc(0, 0, r, 0, Math.PI * 2);
            c.fill();
          },
        });
        for (let k = 0; k < n; k++) {
          const R = 1.7 + k * 0.55;
          const rx = 0.5 + k * 0.62, rz = k * 1.05 + 0.3;
          const on = Easing.out(sub(t, k * 0.08, 0.4 + k * 0.08));
          const pointAt = (a: number): Vec3 => rotateXYZ({ x: Math.cos(a) * R, y: 0, z: Math.sin(a) * R }, rx, 0, rz);
          const N = 72;
          const sweep = Math.PI * 2 * on;
          for (let i = 0; i < N; i++) {
            if ((i / N) * Math.PI * 2 > sweep) break;
            const A = cam.project(pointAt((i / N) * Math.PI * 2)), B = cam.project(pointAt(((i + 1) / N) * Math.PI * 2));
            const d = (A.depth + B.depth) / 2;
            const s = lineByDepth(d, near, far, { minAlpha: 0.12, maxAlpha: 0.9, minWidth: 1, maxWidth: 3 });
            prims.push({ depth: d, draw: (c) => seg(c, A.x, A.y, B.x, B.y, pal.line, s.alpha, s.width) });
          }
          // Satélite.
          const ang = k * 2.1 + t * Math.PI * 2 * (1 + k * 0.5);
          const S = cam.project(pointAt(ang));
          const ss = lineByDepth(S.depth, near, far, { minAlpha: 0.5, maxAlpha: 1, minWidth: 5, maxWidth: 11 });
          prims.push({ depth: S.depth, draw: (c) => dot(c, S.x, S.y, ss.width * on, k % 2 ? pal.ink : pal.accent2, 1) });
        }
        flush(ctx, prims);
      }}
    />
  );
}
