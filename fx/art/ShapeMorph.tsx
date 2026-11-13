import { useId } from "react";
import { Easing } from "../../engine";
import { fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { morphPoints, resample, toPath } from "../data/geom";
import type { Pt } from "../data/geom";

export type ShapeSpec = "circle" | "square" | "triangle" | "hexagon" | "star" | "squircle" | { superellipse: number } | Pt[];
export type ShapeMorphProps = FxProps & { shapes?: ShapeSpec[]; count?: number };

const POINTS = 96;

/** Distancia desde el centro hasta el borde de un poligono, en la direccion `theta` (para formas estrelladas). */
export function rayPoly(vertices: Pt[], theta: number): number {
  const dx = Math.cos(theta), dy = Math.sin(theta);
  let best = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!, b = vertices[(i + 1) % vertices.length]!;
    const ex = b.x - a.x, ey = b.y - a.y;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (a.x * ey - a.y * ex) / den;
    const u = (a.x * dy - a.y * dx) / den;
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
  }
  return best;
}

const regular = (k: number, r: number): Pt[] => Array.from({ length: k }, (_, i) => ({ x: Math.cos(-Math.PI / 2 + (i / k) * Math.PI * 2) * r, y: Math.sin(-Math.PI / 2 + (i / k) * Math.PI * 2) * r }));
const starVerts = (r: number): Pt[] => Array.from({ length: 10 }, (_, i) => {
  const rr = i % 2 === 0 ? r : r * 0.45, a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
  return { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
});

/** Puntos (siempre `n`, alineados por angulo, el primero arriba) de una forma de radio aproximado `r`. */
export function shapePoints(spec: ShapeSpec, r: number, n = POINTS): Pt[] {
  if (Array.isArray(spec)) return spec.length === n ? spec : resample(spec, n, true);
  const at = (f: (th: number) => number): Pt[] => Array.from({ length: n }, (_, i) => {
    const th = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const rr = f(th);
    return { x: Math.cos(th) * rr, y: Math.sin(th) * rr };
  });
  const se = (e: number) => (th: number) => r * Math.pow(Math.pow(Math.abs(Math.cos(th)), e) + Math.pow(Math.abs(Math.sin(th)), e), -1 / e);
  if (spec === "circle") return at(() => r);
  if (typeof spec === "object") return at(se(spec.superellipse));
  if (spec === "squircle") return at(se(4.5));
  if (spec === "square") return at(se(40));
  const verts = spec === "triangle" ? regular(3, r * 1.05) : spec === "hexagon" ? regular(6, r) : starVerts(r * 1.08);
  return at((th) => rayPoly(verts, th));
}

/** Pasa de una forma a la siguiente (mismo numero de puntos o parametros de superelipse). */
export function ShapeMorph(p: ShapeMorphProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 520, height: 520 });
  const shapes = p.shapes ?? ["circle", "square", "star", "hexagon", "circle"];
  const dur = p.duration ?? 80;
  const uid = useId().replace(/\W/g, "");
  const r = Math.min(w, h) * 0.36;
  const lists = shapes.map((s) => shapePoints(s, r, p.count ?? POINTS));
  const segs = lists.length - 1;
  const pr = progress(local, 0, dur) * segs;
  const idx = Math.min(segs - 1, Math.floor(pr));
  const k = segs <= 0 ? 0 : Easing.inOut(pr - idx >= 1 ? 1 : pr - idx);
  const pts = segs <= 0 ? lists[0]! : morphPoints(lists[idx]!, lists[idx + 1]!, k);
  const moved = pts.map((q) => ({ x: q.x + w / 2, y: q.y + h / 2 }));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", ...p.style }}>
      <defs>
        <linearGradient id={`sm-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.color.accent} />
          <stop offset="1" stopColor={theme.color.accent2} />
        </linearGradient>
      </defs>
      <path d={toPath(moved, true)} fill={`url(#sm-${uid})`} stroke={theme.color.surface} strokeWidth={6} strokeLinejoin="round" />
    </svg>
  );
}
