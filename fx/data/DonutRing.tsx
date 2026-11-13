import { withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { fxBox, progress, roleColor, useFx } from "../core";
import type { ColorRole, FxProps } from "../core";
import { arcPoints, fmtInt, toPath } from "./geom";

export type DonutRingProps = FxProps & {
  /** Valor final (0..max). */
  value?: number;
  max?: number;
  label?: string;
  /**
   * Texto del centro. Sin `unit`, el centro muestra el porcentaje de `max` ("100%" con `value=4, max=4`).
   * Con `unit` muestra el valor absoluto seguido de la unidad (`unit=" tareas"` -> "4 tareas"; `unit=""` -> "4").
   */
  unit?: string;
  ticks?: number;
  color?: ColorRole;
};

/** Tamaño por defecto de la caja (px). */
export const DONUT_SIZE = 520;

/** Geometría (px) del anillo en una caja `w` x `h`: centro, radio del arco y grosor del trazo; las marcas quedan afuera (radio + grosor/2 + 12 a + 28). */
export function donutGeometry(w: number, h: number): { cx: number; cy: number; R: number; strokeWidth: number } {
  const R = Math.min(w, h) / 2 - 50;
  return { cx: w / 2, cy: h / 2, R, strokeWidth: R * 0.16 };
}

/** Angulos (rad) del arco de progreso: empieza arriba y avanza en sentido horario. */
export function donutArc(fraction: number): { a0: number; a1: number; sweepDeg: number } {
  const f = Math.min(1, Math.max(0, fraction));
  const a0 = -Math.PI / 2;
  return { a0, a1: a0 + f * Math.PI * 2, sweepDeg: f * 360 };
}

/** Anillo de progreso que se llena hasta un valor, con marcas y el numero al centro. */
export function DonutRing(p: DonutRingProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: DONUT_SIZE, height: DONUT_SIZE });
  const dur = p.duration ?? 60;
  const max = p.max ?? 100, value = p.value ?? 72;
  const color = roleColor(theme, p.color ?? "accent");
  const n = p.ticks ?? 48;
  const k = progress(local, 0, dur * 0.85, Easing.out);
  const frac = (value / max) * k;
  const { cx, cy, R, strokeWidth: sw } = donutGeometry(w, h);
  const arc = donutArc(frac);
  const full = arc.sweepDeg >= 359.9;
  const tickIn = R + sw / 2 + 12, tickOut = R + sw / 2 + 28;
  const shown = (value * k);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      {Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const on = i / n < frac - 1e-9;
        return <line key={i} x1={cx + Math.cos(a) * tickIn} y1={cy + Math.sin(a) * tickIn} x2={cx + Math.cos(a) * tickOut} y2={cy + Math.sin(a) * tickOut} stroke={on ? color : theme.color.border} strokeWidth={on ? 4 : 3} strokeLinecap="round" />;
      })}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={withAlpha(color, 0.16)} strokeWidth={sw} />
      {frac > 0.0005 && (full
        ? <circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={sw} />
        : <path d={toPath(arcPoints(cx, cy, R, arc.a0, arc.a1, 40))} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />)}
      <text x={cx} y={cy + theme.type.h2 * 0.22} textAnchor="middle" fontSize={theme.type.h2} fontWeight={theme.font.weights.stat} fill={theme.color.text} style={{ fontVariantNumeric: "tabular-nums" }}>
        {p.unit === undefined ? `${fmtInt(max > 0 ? (shown / max) * 100 : 0)}%` : `${fmtInt(shown)}${p.unit}`}
      </text>
      <text x={cx} y={cy + theme.type.h2 * 0.22 + theme.type.eyebrow + 14} textAnchor="middle" fontSize={theme.type.eyebrow * 0.85} fill={theme.color.textMuted}>{p.label ?? "Avance"}</text>
    </svg>
  );
}
