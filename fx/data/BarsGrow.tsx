import { Easing } from "../../engine";
import { chartFill, chartStyle, settle, staggerScale, resolveStyle } from "../../themes";
import { chartColor, fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { fmtInt, niceTicks, staggerT } from "./geom";
import { FillDef, fillEdge } from "./styleKit";

export type BarsGrowProps = FxProps & {
  data?: number[];
  labels?: string[];
  /** Un solo color de rol (por defecto, la serie categorica del tema). */
  singleColor?: boolean;
  format?: (n: number) => string;
};

/** Grafico de barras que crece con escalonado y rotulos de valor (el caso comun). */
export function BarsGrow(p: BarsGrowProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 520 });
  const data = p.data ?? [42, 68, 55, 90, 76];
  const labels = p.labels ?? data.map((_, i) => `Ítem ${i + 1}`);
  const dur = p.duration ?? 55;
  const n = data.length;
  const fmt = p.format ?? fmtInt;
  const { max, ticks } = niceTicks(Math.max(...data, 1), 4);
  // Estilo del diseño: radio de barra, rayado/degradado, guías y carácter del movimiento (sobrepaso y paso entre barras).
  const cs = chartStyle(theme);
  const over = resolveStyle(theme).motion.overshoot;
  const spread = Math.min(0.95, 0.5 * staggerScale(theme));
  const top = 70, bot = 64, left = 30;
  const area = h - top - bot;
  const gap = Math.min(36, (w - left * 2) / n / 3);
  const bw = (w - left * 2 - gap * (n - 1)) / n;
  const g = progress(local, 0, dur * 0.2, Easing.out);
  const fs = theme.type.eyebrow * 0.85;
  const fills = data.map((_, i) => chartFill(theme, p.singleColor ? theme.color.accent : chartColor(theme, i), `bars-${p.seed ?? "b"}-${i}-${p.singleColor ? "s" : "c"}-${theme.color.accent}`));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      {fills.some((f) => f.kind !== "solid") && <defs>{fills.map((f) => <FillDef key={f.kind === "solid" ? "s" : f.id} fill={f} />)}</defs>}
      {cs.grid === "on" && ticks.slice(1).map((tk, i) => <line key={`g${i}`} x1={left} x2={w - left} y1={h - bot - (tk / max) * area} y2={h - bot - (tk / max) * area} stroke={theme.color.border} strokeWidth={1.5} opacity={g * 0.7} />)}
      {cs.grid !== "off" && <line x1={left} x2={w - left} y1={h - bot} y2={h - bot} stroke={theme.color.border} strokeWidth={3} opacity={g} />}
      {data.map((v, i) => {
        const t = settle(Easing.out(staggerT(progress(local, 0, dur), i, n, spread)), over);
        const bh = (v / max) * area * t;
        const x = left + i * (bw + gap);
        const r = Math.min(cs.barRadius, bw / 2, Math.max(0, bh / 2));
        const color = p.singleColor ? theme.color.accent : chartColor(theme, i);
        const y = h - bot - bh;
        const d = bh <= 0.5 ? "" : `M${x} ${h - bot} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${h - bot} Z`;
        return (
          <g key={i}>
            {d && <path d={d} fill={fills[i]!.fill} {...fillEdge(fills[i]!, color)} />}
            <text x={x + bw / 2} y={y - 14} textAnchor="middle" fontSize={fs * 1.15} fontWeight={theme.font.weights.semibold} fill={theme.color.text} opacity={Math.min(1, t * 1.5)} style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(v * Math.min(1, t))}</text>
            <text x={x + bw / 2} y={h - bot + fs + 14} textAnchor="middle" fontSize={fs} fill={theme.color.textMuted} opacity={g}>{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
