import { useId } from "react";
import { withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { fxBox, progress, roleColor, useFx } from "../core";
import type { ColorRole, FxProps } from "../core";
import { catmullRom, fmtInt, niceTicks, pointAt, polyLength, toPath, trimPolyline } from "./geom";
import type { Pt } from "./geom";

export type LineDrawProps = FxProps & {
  data?: number[];
  labels?: string[];
  /** Rol de color de la linea (por defecto acento). */
  color?: ColorRole;
  /** Formato del valor que cuenta. */
  format?: (n: number) => string;
  /** Rotulo sobre el valor (por defecto "Total"). */
  title?: string;
  showValue?: boolean;
};

const DEFAULT = [12, 18, 15, 26, 22, 34, 31, 46, 52, 64];

/** Geometria pura del grafico: puntos de la curva (ya muestreada) y tick del eje. */
export function lineLayout(data: number[], w: number, h: number, pad = { l: 78, r: 40, t: 90, b: 64 }) {
  const { max, ticks } = niceTicks(Math.max(...data, 1), 4);
  const x0 = pad.l, x1 = w - pad.r, y0 = h - pad.b, y1 = pad.t;
  const pts: Pt[] = data.map((v, i) => ({ x: x0 + ((x1 - x0) * i) / Math.max(1, data.length - 1), y: y0 - ((y0 - y1) * v) / max }));
  const curve = catmullRom(pts, 10).map((q) => ({ x: q.x, y: Math.min(y0, Math.max(y1, q.y)) }));
  return { max, ticks, pts, curve, x0, x1, y0, y1 };
}

/** Grafico de linea que se dibuja: trazo con un punto en la punta, area que se desvanece, ejes y valor que cuenta. */
export function LineDraw(p: LineDrawProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 520 });
  const data = p.data ?? DEFAULT;
  const labels = p.labels ?? data.map((_, i) => String(i + 1));
  const dur = p.duration ?? 60;
  const color = roleColor(theme, p.color ?? "accent");
  const uid = useId().replace(/\W/g, "");
  const L = lineLayout(data, w, h);
  const tAxes = progress(local, 0, dur * 0.3, Easing.out);
  const draw = progress(local, dur * 0.1, dur * 0.8, Easing.inOut);
  const fade = progress(local, dur * 0.7, dur * 0.3);
  const trimmed = trimPolyline(L.curve, draw);
  const tip = pointAt(L.curve, draw);
  const fmt = p.format ?? fmtInt;
  const last = data[data.length - 1]!;
  const tipValue = L.max * ((L.y0 - tip.y) / (L.y0 - L.y1));
  const value = draw >= 1 ? last : tipValue;
  const fs = theme.type.eyebrow * 0.8;
  const area = trimmed.length > 1 ? `${toPath(trimmed)} L${trimmed[trimmed.length - 1]!.x.toFixed(2)} ${L.y0} L${L.x0} ${L.y0} Z` : "";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      <defs>
        <linearGradient id={`ld-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={withAlpha(color, 0.32)} />
          <stop offset="1" stopColor={withAlpha(color, 0)} />
        </linearGradient>
      </defs>
      {L.ticks.map((tk, i) => {
        const y = L.y0 - ((L.y0 - L.y1) * tk) / L.max;
        return (
          <g key={i} opacity={tAxes}>
            <line x1={L.x0} x2={L.x0 + (L.x1 - L.x0) * tAxes} y1={y} y2={y} stroke={theme.color.border} strokeWidth={1.5} />
            <text x={L.x0 - 14} y={y + fs * 0.35} textAnchor="end" fontSize={fs} fill={theme.color.textMuted}>{fmtInt(tk)}</text>
          </g>
        );
      })}
      {labels.map((lb, i) => {
        if (data.length > 8 && i % 2 === 1) return null;
        return <text key={i} x={L.pts[i]!.x} y={L.y0 + fs + 16} textAnchor="middle" fontSize={fs} fill={theme.color.textMuted} opacity={tAxes}>{lb}</text>;
      })}
      {area && <path d={area} fill={`url(#ld-${uid})`} opacity={fade} />}
      {trimmed.length > 1 && <path d={toPath(trimmed)} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />}
      {draw > 0 && (
        <g>
          <circle cx={tip.x} cy={tip.y} r={16} fill={withAlpha(color, 0.25)} />
          <circle cx={tip.x} cy={tip.y} r={8} fill={theme.color.surface} stroke={color} strokeWidth={4} />
        </g>
      )}
      {p.showValue !== false && (
        <g>
          <text x={L.x0} y={34} fontSize={fs} fill={theme.color.textMuted}>{p.title ?? "Total"}</text>
          <text x={L.x0} y={34 + theme.type.h2 * 0.8} fontSize={theme.type.h2 * 0.8} fontWeight={theme.font.weights.stat} fill={theme.color.text} style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(value)}</text>
        </g>
      )}
    </svg>
  );
}

/** Largo del trazo (util para pruebas). */
export const lineLength = (data: number[], w = 900, h = 520) => polyLength(lineLayout(data, w, h).curve);
