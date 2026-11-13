import { useMemo } from "react";
import { staggerScale, withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { parsePath, pointAt, toPath, trimPolyline } from "../data/geom";
import type { Pt } from "../data/geom";
import { staggerT } from "../data/geom";
import { SvgShadow, svgSurface } from "../data/styleKit";

export type BpShape =
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "path"; d: string };
export type BlueprintDrawProps = FxProps & { shapes?: BpShape[]; dimensions?: boolean; grid?: number };

const DEFAULT: BpShape[] = [
  { type: "rect", x: 90, y: 110, w: 420, h: 300 },
  { type: "circle", cx: 300, cy: 260, r: 84 },
  { type: "line", x1: 90, y1: 260, x2: 510, y2: 260 },
  { type: "rect", x: 580, y: 170, w: 220, h: 150 },
  { type: "path", d: "M580 360 L690 440 L800 360" },
];

/** Contorno de una forma como polilinea (los rectangulos y circulos se cierran). */
export function shapePolyline(s: BpShape): Pt[] {
  if (s.type === "rect") return [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }, { x: s.x, y: s.y }];
  if (s.type === "line") return [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }];
  if (s.type === "circle") return Array.from({ length: 73 }, (_, i) => ({ x: s.cx + Math.cos((i / 72) * Math.PI * 2 - Math.PI / 2) * s.r, y: s.cy + Math.sin((i / 72) * Math.PI * 2 - Math.PI / 2) * s.r }));
  return parsePath(s.d).flat();
}

/** Planos que se dibujan: contornos en orden, grilla, cotas y un punto-pluma brillante en la punta. */
export function BlueprintDraw(p: BlueprintDrawProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 560 });
  const shapes = p.shapes ?? DEFAULT;
  const n = shapes.length;
  const dur = p.duration ?? 85;
  const gs = p.grid ?? 30;
  const polys = useMemo(() => shapes.map(shapePolyline), [shapes]);
  const gridIn = progress(local, 0, dur * 0.15, Easing.out);
  const draw = progress(local, dur * 0.08, dur * 0.8);
  const ts = shapes.map((_, i) => Easing.inOut(staggerT(draw, i, n, Math.min(0.95, 0.6 * staggerScale(theme)))));
  // pluma: la ultima forma con trazo en curso, o la ultima terminada
  let penIdx = -1;
  ts.forEach((t, i) => { if (t > 0) penIdx = i; });
  const pen = penIdx >= 0 ? pointAt(polys[penIdx]!, ts[penIdx]!) : null;
  const penOn = pen && draw < 1 ? 1 : 0;
  const fs = theme.type.eyebrow * 0.8;
  // Estilo del diseño: el papel del plano es una ventana (esquinas, relleno, filo duro o halo); la grilla y las cotas son su contenido y no cambian.
  const surf = svgSurface(theme, "window", { bold: true });
  const paper = surf.fill === theme.color.surface ? theme.color.surfaceAlt : surf.fill;
  const rim = surf.edge !== theme.color.border && surf.border > 0;
  const minor: string[] = [], major: string[] = [];
  for (let x = 0; x <= w; x += gs) (Math.round(x / gs) % 5 === 0 ? major : minor).push(`M${x} 0V${h}`);
  for (let y = 0; y <= h; y += gs) (Math.round(y / gs) % 5 === 0 ? major : minor).push(`M0 ${y}H${w}`);
  const dim = (key: string, x1: number, y1: number, x2: number, y2: number, label: string, t: number, vertical: boolean) => (
    <g key={key} opacity={t} stroke={theme.color.textMuted} strokeWidth={2} fill={theme.color.textMuted}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={x1} y1={y1 - (vertical ? 0 : 8)} x2={x1 + (vertical ? -8 : 0)} y2={y1 + (vertical ? 0 : 8)} />
      <line x1={x2} y1={y2 - (vertical ? 0 : 8)} x2={x2 + (vertical ? -8 : 0)} y2={y2 + (vertical ? 0 : 8)} />
      <text x={vertical ? x1 - 14 : (x1 + x2) / 2} y={vertical ? (y1 + y2) / 2 : y1 + fs + 6} textAnchor={vertical ? "end" : "middle"} fontSize={fs} stroke="none" dominantBaseline={vertical ? "middle" : undefined}>{label}</text>
    </g>
  );
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      <SvgShadow shadow={surf.shadow} x={0} y={0} width={w} height={h} rx={surf.radius} />
      <rect width={w} height={h} fill={paper} rx={surf.radius} {...(rim ? { stroke: surf.edge, strokeWidth: surf.border } : {})} />
      <path d={minor.join(" ")} stroke={theme.color.border} strokeWidth={1} opacity={0.55 * gridIn} fill="none" />
      <path d={major.join(" ")} stroke={theme.color.border} strokeWidth={1.8} opacity={gridIn} fill="none" />
      {shapes.map((_s, i) => {
        const tr = trimPolyline(polys[i]!, ts[i]!);
        return tr.length > 1 ? <path key={i} d={toPath(tr)} fill="none" stroke={theme.color.accent} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /> : null;
      })}
      {p.dimensions !== false && shapes.map((s, i) => {
        const t = Easing.out(progress(ts[i]!, 0.9, 0.1));
        if (t <= 0) return null;
        if (s.type === "rect") return [
          dim(`w${i}`, s.x, s.y + s.h + 26, s.x + s.w, s.y + s.h + 26, String(Math.round(s.w)), t, false),
          dim(`h${i}`, s.x - 26, s.y, s.x - 26, s.y + s.h, String(Math.round(s.h)), t, true),
        ];
        if (s.type === "circle") return dim(`r${i}`, s.cx - s.r, s.cy + s.r + 26, s.cx + s.r, s.cy + s.r + 26, `Ø ${Math.round(s.r * 2)}`, t, false);
        return null;
      })}
      {pen && penOn > 0 && (
        <g>
          <circle cx={pen.x} cy={pen.y} r={22} fill={withAlpha(theme.color.accent, 0.14)} />
          <circle cx={pen.x} cy={pen.y} r={13} fill={withAlpha(theme.color.accent, 0.3)} />
          <circle cx={pen.x} cy={pen.y} r={6} fill={theme.color.accent2} />
        </g>
      )}
    </svg>
  );
}
