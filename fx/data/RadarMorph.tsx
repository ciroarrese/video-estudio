import { withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { fxBox, progress, roleColor, useFx } from "../core";
import type { ColorRole, FxProps } from "../core";
import { toPath } from "./geom";
import type { Pt } from "./geom";

export type RadarMorphProps = FxProps & {
  axes?: string[];
  /** Valores 0..1 por eje, del conjunto inicial. */
  from?: number[];
  /** Valores 0..1 por eje, del conjunto final. */
  to?: number[];
  color?: ColorRole;
};

/** Interpolacion eje a eje entre dos conjuntos de valores. */
export function radarValues(from: number[], to: number[], t: number): number[] {
  if (from.length !== to.length) throw new Error("radarValues: from y to deben tener los mismos ejes");
  return from.map((v, i) => v + (to[i]! - v) * t);
}

/** Vertices del poligono: eje 0 arriba, sentido horario. */
export function radarPoints(cx: number, cy: number, r: number, values: number[]): Pt[] {
  const n = values.length;
  return values.map((v, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r * v, y: cy + Math.sin(a) * r * v };
  });
}

/** Radar de N ejes cuyo poligono se transforma de un conjunto de valores a otro. */
export function RadarMorph(p: RadarMorphProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 640, height: 560 });
  const axes = p.axes ?? ["Alcance", "Calidad", "Ritmo", "Costo", "Soporte", "Equipo"];
  const n = axes.length;
  const from = p.from ?? axes.map((_, i) => 0.35 + 0.1 * ((i * 3) % 4));
  const to = p.to ?? axes.map((_, i) => 0.55 + 0.4 * (((i * 5) % 6) / 5));
  const dur = p.duration ?? 70;
  const color = roleColor(theme, p.color ?? "accent");
  const grid = progress(local, 0, dur * 0.25, Easing.out);
  const morph = progress(local, dur * 0.3, dur * 0.7, Easing.inOut);
  const intro = progress(local, dur * 0.1, dur * 0.2, Easing.out);
  const cx = w / 2, cy = h / 2 + 6, R = Math.min(w, h) / 2 - 78;
  const fs = theme.type.eyebrow * 0.8;
  const vals = radarValues(from, to, morph).map((v) => v * intro);
  const pts = radarPoints(cx, cy, R, vals);
  const ring = (k: number) => toPath(radarPoints(cx, cy, R * grid, Array(n).fill(k)), true);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      {[0.25, 0.5, 0.75, 1].map((k) => <path key={k} d={ring(k)} fill="none" stroke={theme.color.border} strokeWidth={1.5} />)}
      {radarPoints(cx, cy, R * grid, Array(n).fill(1)).map((q, i) => <line key={i} x1={cx} y1={cy} x2={q.x} y2={q.y} stroke={theme.color.border} strokeWidth={1.5} />)}
      <path d={toPath(pts, true)} fill={withAlpha(color, 0.22)} stroke={color} strokeWidth={4} strokeLinejoin="round" />
      {pts.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={7} fill={theme.color.surface} stroke={color} strokeWidth={3.5} />)}
      {axes.map((ax, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const lx = cx + Math.cos(a) * (R + 22), ly = cy + Math.sin(a) * (R + 22);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        return <text key={i} x={lx} y={ly + fs * (Math.sin(a) > 0.5 ? 0.9 : Math.sin(a) < -0.5 ? -0.1 : 0.35)} textAnchor={anchor} fontSize={fs} fill={theme.color.textMuted} opacity={grid}>{ax}</text>;
      })}
    </svg>
  );
}
