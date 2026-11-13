import { random } from "../engine";

/** Semilla de "hervor": cambia cada `every` cuadros (por defecto 3), como en animación dibujada a mano. */
export const boilSeed = (frame: number, every = 3) => Math.floor(frame / Math.max(1, every));

type Pt = [number, number];
const str = (pts: Pt[]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

/** Puntos (polilínea) de una elipse temblorosa que se pasa un poco de su inicio. */
export function circlePoints(seed: string, frame: number, cx: number, cy: number, rx: number, ry: number, every = 3): string {
  const s = boilSeed(frame, every);
  const n = 28;
  const pts: Pt[] = [];
  for (let i = 0; i <= n + 3; i++) {
    const a = -2.2 + (i / n) * Math.PI * 2.15;
    const jx = (random(`${seed}-${s}-${i}-x`) - 0.5) * 7;
    const jy = (random(`${seed}-${s}-${i}-y`) - 0.5) * 7;
    const grow = 1 + (i / n) * 0.06;
    pts.push([cx + Math.cos(a) * (rx + jx) * grow, cy + Math.sin(a) * (ry + jy) * grow]);
  }
  return str(pts);
}

/** Puntos de la curva de una flecha (cuadrática con temblor); sin la cabeza. */
export function arrowPoints(seed: string, frame: number, x1: number, y1: number, x2: number, y2: number, bend = 0.25, every = 3): Pt[] {
  const s = boilSeed(frame, every);
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend;
  const my = (y1 + y2) / 2 + (x2 - x1) * bend;
  const n = 24;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
    const end = i === 0 || i === n;
    const jx = end ? 0 : (random(`${seed}-${s}-${i}-x`) - 0.5) * 4;
    const jy = end ? 0 : (random(`${seed}-${s}-${i}-y`) - 0.5) * 4;
    pts.push([x + jx, y + jy]);
  }
  return pts;
}

/** Puntos de un subrayado ondulado de (x, y) hasta (x + width, y). */
export function underlinePoints(seed: string, frame: number, x: number, y: number, width: number, every = 3): string {
  const s = boilSeed(frame, every);
  const n = 20;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = (random(`${seed}-${s}-${i}`) - 0.5) * 5;
    pts.push([x + t * width, y + Math.sin(t * Math.PI * 2) * 3 + j]);
  }
  return str(pts);
}

export const pointsToArray = (points: string): Pt[] => points.split(" ").map((p) => p.split(",").map(Number) as Pt);

export function polylineLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return l;
}

export { str as pointsToString };
