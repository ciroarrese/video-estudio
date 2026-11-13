import { Easing, FrameCanvas, clamp, mix, sub } from "../core";
import { camera, lineByDepth, sortBackToFront } from "./math";
import { dot, useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type WaveDotsProps = ThreeProps & {
  /** Puntos por lado. */
  grid?: number;
  /** Altura de las olas (unidades). */
  amplitude?: number;
};

/** Campo de puntos sobre un plano con olas que viajan (suma de una onda plana y una radial). */
export function WaveDots(p: WaveDotsProps) {
  const { t, width, height, pal, k } = useThreeFx(p, { width: 1100, height: 700, duration: 75 });
  const g = p.grid ?? 36;
  const amp = p.amplitude ?? 0.45;
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const unit = Math.min(width, height) * 0.5;
        const cam = camera({ distance: 4.2, tilt: 0.78, yaw: 0.5, unit });
        ctx.translate(width / 2, height * 0.5);
        const phase = t * Math.PI * 4;
        const grow = Easing.out(sub(t, 0, 0.5));
        const items: { x: number; y: number; depth: number; h: number; k: number }[] = [];
        for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
          const x = (i / (g - 1) - 0.5) * 3.4, z = (j / (g - 1) - 0.5) * 3.4;
          const r = Math.hypot(x, z);
          const h = amp * grow * (0.6 * Math.sin(r * 3.2 - phase) + 0.4 * Math.sin(x * 2.1 + z * 1.3 - phase * 0.5)) * clamp(1.3 - r * 0.35);
          const pr = cam.project({ x, y: h, z });
          items.push({ x: pr.x, y: pr.y, depth: pr.depth, h, k: Math.min(1, Math.max(0, h / amp / 1.2 + 0.5)) });
        }
        const near = 2.6, far = 5.8;
        for (const q of sortBackToFront(items, (z) => z.depth)) {
          const st = lineByDepth(q.depth, near, far, { minAlpha: 0.2, maxAlpha: 1, minWidth: 1.4 * k, maxWidth: 4.2 * k });
          dot(ctx, q.x, q.y, st.width, mix(pal.line, pal.accent, clamp((q.k - 0.45) * 2)), st.alpha);
        }
      }}
    />
  );
}
