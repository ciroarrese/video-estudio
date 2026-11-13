import { withAlpha, textStyle } from "../../themes";
import { Easing } from "../../engine";
import { fade, fxBox, progress, svgScale, useFx } from "../core";
import type { FxProps } from "../core";
import { toPath } from "../data/geom";
import type { Pt } from "../data/geom";

export type SealSpinProps = FxProps & { text?: string; turns?: number };

/** Angulo (grados) del anillo de texto: gira y frena hasta quedar en 0 (mod 360). */
export function sealAngle(t: number, turns = 1.5): number {
  return -(1 - Easing.out(Math.min(1, Math.max(0, t)))) * turns * 360;
}

const star = (cx: number, cy: number, R: number): Pt[] => Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? R : R * 0.42, a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
});

/** Sello circular con texto sobre un trazado que gira alrededor de una marca central. */
export function SealSpin(p: SealSpinProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 520, height: 520 });
  const dur = p.duration ?? 75;
  const uid = `sp${w}x${h}`;
  const t = progress(local, 0, dur);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 16;
  const rt = R * 0.8;
  const circ = 2 * Math.PI * rt;
  const text = p.text ?? "SELLO DE CALIDAD • EDICIÓN LIMITADA • ";
  const pop = Easing.lands(progress(local, 0, dur * 0.3));
  const ang = sealAngle(t, p.turns ?? 1.5);
  const fs = theme.type.eyebrow * 0.95;
  const ticks = 72;
  // Escala y opacidad solo mientras el sello aparece (en reposo no queda `scale(1)`).
  const gp = { transform: svgScale(cx, cy, 0.6 + 0.4 * Math.min(1.08, pop)), opacity: fade(Math.min(1, pop * 2)) };
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      <defs><path id={`sp-${uid}`} d={`M${cx - rt} ${cy} a${rt} ${rt} 0 1 1 ${2 * rt} 0 a${rt} ${rt} 0 1 1 ${-2 * rt} 0`} /></defs>
      <g key={`${gp.transform ? "t" : ""}${gp.opacity === undefined ? "" : "o"}`} {...gp}>
        <circle cx={cx} cy={cy} r={R} fill={theme.color.surface} stroke={theme.color.accent} strokeWidth={6} />
        <circle cx={cx} cy={cy} r={R - 14} fill="none" stroke={theme.color.accent} strokeWidth={2} />
        <g transform={`rotate(${ang.toFixed(3)} ${cx} ${cy})`}>
          <text fontSize={fs} fontWeight={textStyle(theme, "label", { strong: true }).fontWeight} fill={theme.color.text} letterSpacing={2}>
            <textPath href={`#sp-${uid}`} startOffset={0} textLength={circ * 0.985} lengthAdjust="spacing">{text}</textPath>
          </text>
          {Array.from({ length: ticks }, (_, i) => {
            const a = (i / ticks) * Math.PI * 2;
            return <line key={i} x1={cx + Math.cos(a) * (R - 26)} y1={cy + Math.sin(a) * (R - 26)} x2={cx + Math.cos(a) * (R - 32)} y2={cy + Math.sin(a) * (R - 32)} stroke={theme.color.border} strokeWidth={2} />;
          })}
        </g>
        <circle cx={cx} cy={cy} r={rt * 0.66} fill={withAlpha(theme.color.accent, 0.1)} stroke={theme.color.accent} strokeWidth={3} />
        <g transform={`rotate(${(-ang * 0.8).toFixed(3)} ${cx} ${cy})`}>
          <path d={toPath(star(cx, cy, rt * 0.46), true)} fill={theme.color.accent} stroke={theme.color.accent2} strokeWidth={4} strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}
