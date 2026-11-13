import { withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { chartColor, fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { fmtInt, staggerT, toPath } from "./geom";
import type { Pt } from "./geom";

export type Bars3DProps = FxProps & {
  data?: number[];
  labels?: string[];
  format?: (n: number) => string;
};

const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
/** Proyeccion isometrica (x a la derecha-abajo, y a la izquierda-abajo, z arriba). */
export const iso = (x: number, y: number, z: number): Pt => ({ x: (x - y) * C30, y: (x + y) * S30 - z });

/** Las tres caras visibles (arriba, frente, derecha) de una caja que sube desde z=0 hasta `z`. */
export function boxFaces(x0: number, y0: number, x1: number, y1: number, z: number): { top: Pt[]; front: Pt[]; right: Pt[] } {
  return {
    top: [iso(x0, y0, z), iso(x1, y0, z), iso(x1, y1, z), iso(x0, y1, z)],
    front: [iso(x0, y1, 0), iso(x1, y1, 0), iso(x1, y1, z), iso(x0, y1, z)],
    right: [iso(x1, y0, 0), iso(x1, y1, 0), iso(x1, y1, z), iso(x1, y0, z)],
  };
}

/** Barras isometricas que suben en ola, con sombreado plano por cara. */
export function Bars3D(p: Bars3DProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 560 });
  const data = p.data ?? [40, 62, 48, 85, 70, 95];
  const labels = p.labels ?? data.map((_, i) => String(i + 1));
  const dur = p.duration ?? 65;
  const fmt = p.format ?? fmtInt;
  const n = data.length;
  const bw = 64, gap = 44, D = 64, Hmax = 170;
  const Lx = n * bw + (n - 1) * gap;
  const max = Math.max(...data, 1);
  const spanX = (Lx + D) * C30, spanY = (Lx + D) * S30 + Hmax + 50;
  const s = Math.min((w - 80) / spanX, (h - 70) / spanY);
  const ox = w / 2 - s * ((Lx - D) * C30) / 2;
  const oy = h / 2 + s * (((Lx + D) * S30 - Hmax) / 2) - 8;
  const P = (q: Pt) => ({ x: ox + q.x * s, y: oy + q.y * s });
  const poly = (pts: Pt[]) => toPath(pts.map(P), true);
  const slab = [iso(-30, -30, 0), iso(Lx + 30, -30, 0), iso(Lx + 30, D + 30, 0), iso(-30, D + 30, 0)];
  const g = progress(local, 0, dur * 0.2, Easing.out);
  const fs = theme.type.eyebrow * 0.85;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      <path d={poly(slab)} fill={theme.color.surfaceAlt} stroke={theme.color.border} strokeWidth={2} opacity={g} />
      {data.map((v, i) => {
        const t = Easing.lands(staggerT(progress(local, 0, dur), i, n, 0.6));
        const z = Math.max(0, (v / max) * Hmax * t);
        const x0 = i * (bw + gap), x1 = x0 + bw;
        const base = chartColor(theme, i);
        const f = boxFaces(x0, 0, x1, D, z);
        const top = P(iso((x0 + x1) / 2, D / 2, z));
        const lab = P(iso((x0 + x1) / 2, D + 34, 0));
        return (
          <g key={i}>
            {z > 0.5 && (
              <>
                <path d={poly(f.front)} fill={base} />
                <path d={poly(f.right)} fill={base} />
                <path d={poly(f.right)} fill={withAlpha(theme.color.text, 0.28)} />
                <path d={poly(f.top)} fill={base} />
                <path d={poly(f.top)} fill={withAlpha(theme.color.surface, 0.38)} />
              </>
            )}
            <text x={top.x} y={top.y - 16} textAnchor="middle" fontSize={fs * 1.1} fontWeight={theme.font.weights.semibold} fill={theme.color.text} opacity={Math.min(1, t)} style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(v * Math.min(1, t))}</text>
            <text x={lab.x} y={lab.y} textAnchor="middle" fontSize={fs} fill={theme.color.textMuted} opacity={g}>{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
