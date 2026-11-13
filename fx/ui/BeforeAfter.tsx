import type React from "react";
import { Easing } from "../../engine";
import { kf } from "../../kit";
import { fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";

export type BeforeAfterProps = FxProps & {
  before?: React.ReactNode;
  after?: React.ReactNode;
  /** Donde queda la manija al final (0..1). */
  rest?: number;
  beforeLabel?: string;
  afterLabel?: string;
};

/** Posicion de la manija (0..1): barre hasta el otro extremo y se asienta en `rest`. */
export function wipePosition(t: number, rest = 0.5): number {
  const t0 = Math.min(1, Math.max(0, t));
  return kf(t0, [0, 0.7, 1], [0.04, 0.96, rest], Easing.inOut);
}

/** Recorte (en % desde la derecha) de la capa "despues" para una posicion de manija. */
export const wipeInset = (pos: number): number => +(100 - pos * 100).toFixed(3);

function Wireframe({ w, h }: { w: number; h: number }) {
  const { theme } = useFx({});
  const s = { fill: "none", stroke: theme.color.textMuted, strokeWidth: 2.5, strokeDasharray: "9 7" } as const;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <rect width={w} height={h} fill={theme.color.bg} />
      <rect x={40} y={36} width={w - 80} height={64} rx={4} {...s} />
      <rect x={40} y={128} width={(w - 120) * 0.55} height={h - 270} rx={4} {...s} />
      <line x1={40} y1={128} x2={40 + (w - 120) * 0.55} y2={h - 142} {...s} />
      <line x1={40 + (w - 120) * 0.55} y1={128} x2={40} y2={h - 142} {...s} />
      {[0, 1, 2].map((i) => <rect key={i} x={40 + (w - 120) * 0.55 + 40} y={128 + i * 70} width={(w - 120) * 0.45} height={46} rx={4} {...s} />)}
      <rect x={40} y={h - 100} width={180} height={52} rx={4} {...s} />
    </svg>
  );
}

function Design({ w, h }: { w: number; h: number }) {
  const { theme } = useFx({});
  const mw = (w - 120) * 0.55;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <rect width={w} height={h} fill={theme.color.surface} />
      <rect x={40} y={36} width={w - 80} height={64} rx={theme.radius.md} fill={theme.color.surfaceAlt} />
      <circle cx={76} cy={68} r={14} fill={theme.color.accent} />
      <rect x={104} y={60} width={110} height={16} rx={8} fill={theme.color.text} />
      <rect x={40} y={128} width={mw} height={h - 270} rx={theme.radius.lg} fill={theme.color.accent} />
      <circle cx={40 + mw * 0.7} cy={128 + (h - 270) * 0.35} r={(h - 270) * 0.22} fill={theme.color.accent2} opacity={0.85} />
      {[0, 1, 2].map((i) => <rect key={i} x={40 + mw + 40} y={128 + i * 70} width={(w - 120) * 0.45} height={46} rx={theme.radius.md} fill={theme.color.surfaceAlt} stroke={theme.color.border} />)}
      <rect x={40} y={h - 100} width={180} height={52} rx={theme.radius.pill} fill={theme.color.accent} />
      <rect x={72} y={h - 80} width={116} height={12} rx={6} fill={theme.color.onAccent} />
    </svg>
  );
}

/** Una manija que barre y revela el "despues" sobre el "antes" (por defecto: esquema de alambre -> diseño). */
export function BeforeAfter(p: BeforeAfterProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 560 });
  const dur = p.duration ?? 70;
  const pos = wipePosition(progress(local, 0, dur), p.rest ?? 0.5);
  const hx = pos * w;
  const fs = theme.type.eyebrow * 0.85;
  const chip = (txt: string, left: boolean) => (
    <div style={{ position: "absolute", top: 18, [left ? "left" : "right"]: 18, padding: "6px 18px", fontSize: fs, fontWeight: theme.font.weights.semibold, background: theme.color.surface, color: theme.color.text, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.pill }}>{txt}</div>
  );
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", fontFamily: theme.font.family, border: `2px solid ${theme.color.border}`, borderRadius: theme.radius.lg, boxSizing: "border-box", ...p.style }}>
      <div style={{ position: "absolute", inset: 0 }}>{p.before ?? <Wireframe w={w} h={h} />}</div>
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${wipeInset(pos)}% 0 0)` }}>{p.after ?? <Design w={w} h={h} />}</div>
      {chip(p.afterLabel ?? "Después", true)}
      {chip(p.beforeLabel ?? "Antes", false)}
      <div style={{ position: "absolute", left: hx - 2, top: 0, width: 4, height: h, background: theme.color.accent }} />
      <svg width={56} height={56} style={{ position: "absolute", left: hx - 28, top: h / 2 - 28 }} viewBox="0 0 56 56">
        <circle cx={28} cy={28} r={26} fill={theme.color.accent} stroke={theme.color.surface} strokeWidth={4} />
        <path d="M22 20 L14 28 L22 36 M34 20 L42 28 L34 36" fill="none" stroke={theme.color.onAccent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
