import { FrameCanvas, Easing } from "../core";
import { camera, depthFade, rotateZ } from "./math";
import type { Vec3 } from "./math";
import { useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type TunnelProps = ThreeProps & {
  /** Cantidad de marcos visibles. */
  rings?: number;
  /** Cada cuántos marcos uno va en acento. */
  accentEvery?: number;
  /** Lados de cada marco (4 = cuadrado). */
  sides?: number;
};

/** Vuelo por marcos de alambre que giran; cada N-ésimo en acento y más gruesos al acercarse. */
export function Tunnel(p: TunnelProps) {
  const { t, width, height, pal, k: sw, pen } = useThreeFx(p, { width: 1000, height: 700, duration: 75 });
  const rings = p.rings ?? 15;
  const every = pen.every(p.accentEvery ?? 4);
  const sides = p.sides ?? 4;
  return (
    <FrameCanvas
      width={width}
      height={height}
      frame={p.frame}
      style={p.style}
      draw={(ctx) => {
        const unit = Math.min(width, height) * 0.6;
        const D = 1; // distancia de referencia: escala = D / profundidad
        const gap = 0.6;
        const nearCut = 0.9;
        const travel = (Easing.out(t) * 0.5 + t * 0.5) * 9.6; // avance en unidades de profundidad
        const shift = Math.floor(travel / gap);
        const frac = travel / gap - shift;
        const sway = Math.sin(t * Math.PI * 2) * 0.12;
        const cam = camera({ distance: D, tilt: sway * 0.6, yaw: sway, unit });
        ctx.translate(width / 2, height / 2);
        pen.caps(ctx, { cap: true, join: true });
        const far = nearCut + rings * gap;
        // Del fondo al frente: el marco de índice k queda a profundidad nearCut + (k - frac) * gap.
        const prev: { x: number; y: number; depth: number }[][] = [];
        for (let k = rings; k >= 0; k--) {
          const depth = nearCut + (k - frac) * gap;
          if (depth < nearCut * 0.7) { prev.push([]); continue; }
          const id = k + shift; // identidad estable del marco al avanzar
          const roll = id * 0.14;
          const pts = [] as { x: number; y: number; depth: number }[];
          for (let s = 0; s < sides; s++) {
            const ang = (s / sides) * Math.PI * 2 + Math.PI / sides;
            const base: Vec3 = rotateZ({ x: Math.cos(ang) * Math.SQRT2 * 0.6, y: Math.sin(ang) * Math.SQRT2 * 0.6, z: 0 }, roll);
            const q: Vec3 = { x: base.x, y: base.y, z: D - depth };
            pts.push({ ...cam.project(q), depth });
          }
          const accent = id % every === 0;
          const fadeIn = depthFade(depth, far * 0.55, far); // aparece de a poco al fondo
          const fadeOut = Math.min(1, Math.max(0, (depth - nearCut * 0.75) / (nearCut * 0.35))); // se va al pasar
          const a = Math.min(fadeIn, fadeOut);
          const sty = (d: number) => {
            const s = pen.byDepth(d, nearCut, far * 0.8, { minAlpha: 0.1, maxAlpha: 1, minWidth: 1.2 * sw, maxWidth: 9 * sw });
            return { alpha: s.alpha * a, width: s.width };
          };
          // Relleno de fondo: lo de atrás queda tapado por el marco que pasa (con hueco: solo se trazan los bordes).
          pen.polyline(ctx, pts, accent ? pal.accent : pen.quiet(pal.line), sty, true, { main: accent });
          // Aristas hacia el marco anterior (más lejano).
          const back = prev[prev.length - 1];
          if (back && back.length === pts.length) {
            for (let s = 0; s < pts.length; s++) {
              const st = sty((back[s]!.depth + pts[s]!.depth) / 2);
              pen.seg(ctx, back[s]!.x, back[s]!.y, pts[s]!.x, pts[s]!.y, pen.quiet(pal.line), st.alpha * 0.28, Math.max(0.8 * sw, st.width * 0.4));
            }
          }
          prev.push(pts);
        }
      }}
    />
  );
}
