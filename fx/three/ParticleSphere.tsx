import { Easing, FrameCanvas, lerp, mix, progress, random } from "../core";
import { camera, fibonacciSphere, lerp3, lineByDepth, sortBackToFront } from "./math";
import type { Vec3 } from "./math";
import { dot, useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type ParticleSphereProps = ThreeProps & {
  /** Cantidad de puntos (aprox.; se redondea a una grilla). */
  count?: number;
  /** Fracción en acento (0..1). */
  accentShare?: number;
};

interface Cloud { grid: Vec3[]; sphere: Vec3[] }
const cache = new Map<number, Cloud>();

/** Grilla plana y esfera de ángulo áureo para `n` puntos (memoria pura: solo depende de `n`). */
function cloud(n: number): Cloud {
  let c = cache.get(n);
  if (!c) {
    const cols = Math.round(Math.sqrt(n * 1.6));
    const rows = Math.ceil(n / cols);
    const grid: Vec3[] = [];
    for (let i = 0; i < n; i++) {
      const cx = i % cols, cy = Math.floor(i / cols);
      grid.push({ x: ((cx + 0.5) / cols - 0.5) * 2.6, y: (0.5 - (cy + 0.5) / rows) * 1.6, z: 0 });
    }
    // Se ordena la esfera por altura para que cada punto de la grilla vaya a un vecino coherente.
    const sphere = fibonacciSphere(n).sort((a, b) => b.y - a.y || a.x - b.x);
    c = { grid, sphere };
    cache.set(n, c);
  }
  return c;
}

/** ~1000 puntos que pasan de una grilla plana a una esfera que gira. */
export function ParticleSphere(p: ParticleSphereProps) {
  const { local, t, width, height, pal } = useThreeFx(p, { width: 900, height: 900, duration: 75 });
  const n = p.count ?? 1000;
  const share = p.accentShare ?? 0.12;
  const seed = p.seed ?? "psphere";
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const { grid, sphere } = cloud(n);
        const R = Math.min(width, height) * 0.42;
        const yaw = lerp(-1.2, 1.4, Easing.out(t));
        const settle = lerp(0.9, 1, Easing.lands(progress(local, 0, 30)));
        const cam = camera({ distance: 3.6, tilt: lerp(0.0, 0.35, Easing.inOut(t)), yaw, unit: R * settle });
        ctx.translate(width / 2, height / 2);
        const items: { x: number; y: number; depth: number; acc: boolean; scale: number }[] = [];
        for (let i = 0; i < n; i++) {
          const delay = random(`${seed}:${i}`) * 0.3;
          const e = Easing.inOut(progress(t, 0.08 + delay * 0.6, 0.55));
          const q = lerp3(grid[i]!, sphere[i]!, e);
          // La grilla gira poco; al volverse esfera gira entero (la cámara ya lo hace).
          const pr = cam.project(q);
          items.push({ x: pr.x, y: pr.y, depth: pr.depth, scale: pr.scale, acc: random(`${seed}:a:${i}`) < share });
        }
        const sorted = sortBackToFront(items, (q) => q.depth);
        const near = 2.6, far = 4.6;
        for (const q of sorted) {
          const st = lineByDepth(q.depth, near, far, { minAlpha: 0.15, maxAlpha: 1, minWidth: 1.2, maxWidth: 3.4 });
          dot(ctx, q.x, q.y, st.width * (q.acc ? 1.25 : 1), q.acc ? pal.accent : mix(pal.ink, pal.line, 0.4), st.alpha);
        }
      }}
    />
  );
}
