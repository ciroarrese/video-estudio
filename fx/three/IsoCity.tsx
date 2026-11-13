import { Easing, FrameCanvas, progress, random } from "../core";
import { isometric } from "./math";
import { useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type IsoCityProps = ThreeProps & {
  /** Bloques por lado. */
  grid?: number;
  /** Altura máxima (unidades). */
  maxHeight?: number;
};

/** Bloques isométricos que suben en una ola diagonal; los más altos van en acento. */
export function IsoCity(p: IsoCityProps) {
  const { local, width, height, pal, k, pen } = useThreeFx(p, { width: 1100, height: 760, duration: 75 });
  const g = p.grid ?? 7;
  const maxH = p.maxHeight ?? 3.2;
  const seed = p.seed ?? "isocity";
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const unit = Math.min((width * 0.94) / (g * 1.732 + 0.4), (height * 1.0) / (g + maxH * 1.1));
        ctx.translate(width / 2, height * 0.58 + (maxH * unit) / 2 - (g * unit) / 2 + 20);
        const c = (g - 1) / 2;
        const foot = 0.78;
        // Base: losa de la ciudad.
        const slab = [[-0.5, -0.5], [g - 0.5, -0.5], [g - 0.5, g - 0.5], [-0.5, g - 0.5]].map(([x, z]) => isometric({ x: x! - c, y: 0, z: z! - c }, unit));
        pen.face(ctx, slab, pal.surface, 0.8, 1.5 * k, pal.line, 0.6);
        const order: [number, number][] = [];
        for (let s = 0; s <= 2 * (g - 1); s++) for (let i = 0; i < g; i++) { const j = s - i; if (j >= 0 && j < g) order.push([i, j]); }
        for (const [i, j] of order) {
          const full = 0.45 + random(`${seed}:${i}:${j}`) * (maxH - 0.45) * (0.35 + 0.65 * Math.exp(-(((i - c) ** 2 + (j - c) ** 2) / (g * 1.6)))) ;
          const e = Easing.lands(progress(local, (i + j) * 2.2, 26));
          const h = Math.max(0.02, full * e);
          const tall = full > maxH * (0.62 + pen.bias);
          const base = tall ? pal.accent : pen.quiet(pal.line);
          const x0 = i - c - foot / 2, x1 = i - c + foot / 2, z0 = j - c - foot / 2, z1 = j - c + foot / 2;
          const P = (x: number, y: number, z: number) => isometric({ x, y, z }, unit);
          if (pen.extrude === "long-shadow" && h > 0.3) {
            // Sombra larga sobre el suelo, hacia el frente: el casco de la huella y la huella corrida.
            const d = h * 0.55;
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = pal.darkest;
            ctx.beginPath();
            [P(x0, 0, z0), P(x1, 0, z0), P(x1 + d, 0, z0 + d), P(x1 + d, 0, z1 + d), P(x0 + d, 0, z1 + d), P(x0, 0, z1)].forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          // Cara izquierda (z+), derecha (x+) y techo.
          pen.face(ctx, [P(x0, h, z1), P(x1, h, z1), P(x1, 0, z1), P(x0, 0, z1)], base, 0.4, 1.2 * k, pal.bg);
          pen.face(ctx, [P(x1, h, z1), P(x1, h, z0), P(x1, 0, z0), P(x1, 0, z1)], base, 0.2, 1.2 * k, pal.bg);
          pen.face(ctx, [P(x0, h, z0), P(x1, h, z0), P(x1, h, z1), P(x0, h, z1)], base, 0.95, 1.2 * k, pal.bg);
        }
      }}
    />
  );
}
