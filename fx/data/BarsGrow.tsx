import { Easing } from "../../engine";
import { chartColor, fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { fmtInt, niceTicks, staggerT } from "./geom";

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
  const { max } = niceTicks(Math.max(...data, 1), 4);
  const top = 70, bot = 64, left = 30;
  const area = h - top - bot;
  const gap = Math.min(36, (w - left * 2) / n / 3);
  const bw = (w - left * 2 - gap * (n - 1)) / n;
  const g = progress(local, 0, dur * 0.2, Easing.out);
  const fs = theme.type.eyebrow * 0.85;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      <line x1={left} x2={w - left} y1={h - bot} y2={h - bot} stroke={theme.color.border} strokeWidth={3} opacity={g} />
      {data.map((v, i) => {
        const t = Easing.out(staggerT(progress(local, 0, dur), i, n, 0.5));
        const bh = (v / max) * area * t;
        const x = left + i * (bw + gap);
        const r = Math.min(theme.radius.md, bw / 2, Math.max(0, bh / 2));
        const fill = p.singleColor ? theme.color.accent : chartColor(theme, i);
        const y = h - bot - bh;
        const d = bh <= 0.5 ? "" : `M${x} ${h - bot} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${h - bot} Z`;
        return (
          <g key={i}>
            {d && <path d={d} fill={fill} />}
            <text x={x + bw / 2} y={y - 14} textAnchor="middle" fontSize={fs * 1.15} fontWeight={theme.font.weights.semibold} fill={theme.color.text} opacity={Math.min(1, t * 1.5)} style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(v * t)}</text>
            <text x={x + bw / 2} y={h - bot + fs + 14} textAnchor="middle" fontSize={fs} fill={theme.color.textMuted} opacity={g}>{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
