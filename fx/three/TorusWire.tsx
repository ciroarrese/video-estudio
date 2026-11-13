import { Easing, FrameCanvas, lerp, sub } from "../core";
import { camera, rotateXYZ, sortBackToFront } from "./math";
import type { Vec3 } from "./math";
import { useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type TorusWireProps = ThreeProps & {
  /** Radio mayor y menor (unidades relativas; el mayor ocupa ~1). */
  minor?: number;
  segments?: [number, number];
};

/** Toro de alambre: se dibuja alrededor y gira; las caras tapan lo de atrás. */
export function TorusWire(p: TorusWireProps) {
  const { t, width, height, pal, k, pen } = useThreeFx(p, { width: 900, height: 900, duration: 75 });
  const minor = p.minor ?? 0.38;
  const [U, V] = p.segments ?? [40, 16];
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const unit = Math.min(width, height) * 0.4;
        const cam = camera({ distance: 4.6, tilt: 0, yaw: 0, unit });
        const rx = lerp(1.1, 0.55, Easing.out(t)), ry = lerp(-1.4, 0.7, Easing.out(t));
        const reveal = Easing.inOut(sub(t, 0, 0.55));
        const uMax = Math.round(U * reveal);
        const pt = (u: number, v: number): Vec3 => {
          const a = (u / U) * Math.PI * 2, b = (v / V) * Math.PI * 2;
          const r = 1 + minor * Math.cos(b);
          return rotateXYZ({ x: r * Math.cos(a), y: minor * Math.sin(b), z: r * Math.sin(a) }, rx, ry);
        };
        ctx.translate(width / 2, height / 2);
        const quads: { pts: { x: number; y: number }[]; depth: number; u: number; v: number }[] = [];
        for (let u = 0; u < uMax; u++) for (let v = 0; v < V; v++) {
          const c = [pt(u, v), pt(u + 1, v), pt(u + 1, v + 1), pt(u, v + 1)].map((q) => cam.project(q));
          quads.push({ pts: c, depth: (c[0]!.depth + c[1]!.depth + c[2]!.depth + c[3]!.depth) / 4, u, v });
        }
        const near = 3.2, far = 6;
        for (const q of sortBackToFront(quads, (z) => z.depth)) {
          const st = pen.byDepth(q.depth, near, far, { minAlpha: 0.12, maxAlpha: 0.95, minWidth: 0.8 * k, maxWidth: 2 * k });
          const acc = q.u % pen.every(10) === 0 || (q.v === 3 && !pen.sparse); // meridiano y anillo en acento
          pen.poly(ctx, q.pts, pal.bg, acc ? pal.accent : pen.quiet(pal.line), acc ? st.width + 0.8 * k : st.width, acc ? Math.max(0.5, st.alpha) : st.alpha, !acc);
        }
      }}
    />
  );
}
