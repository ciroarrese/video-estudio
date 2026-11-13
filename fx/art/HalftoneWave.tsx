import { useId } from "react";
import { Easing } from "../../engine";
import { fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";

export type HalftoneWaveProps = FxProps & { spacing?: number; angle?: number };

/** Radio (0..1 del maximo) del punto en (x, y) para una fase de onda. */
export function halftoneRadius(x: number, y: number, phase: number, angle: number, wavelength: number): number {
  const s = ((x * Math.cos(angle) + y * Math.sin(angle)) / wavelength) * Math.PI * 2 - phase;
  return 0.16 + 0.84 * (0.5 + 0.5 * Math.sin(s));
}

/** Campo de puntos de semitono modulado por una onda que viaja y se detiene. */
export function HalftoneWave(p: HalftoneWaveProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 560 });
  const dur = p.duration ?? 80;
  const sp = p.spacing ?? 28;
  const angle = p.angle ?? 0.5;
  const uid = useId().replace(/\W/g, "");
  const amp = Easing.out(progress(local, 0, dur * 0.25));
  const phase = Easing.out(progress(local, 0, dur)) * Math.PI * 2 * 3;
  const cols = Math.floor(w / sp), rows = Math.floor(h / sp);
  const ox = (w - (cols - 1) * sp) / 2, oy = (h - (rows - 1) * sp) / 2;
  const dots: JSX.Element[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ox + c * sp, y = oy + r * sp;
      const rad = halftoneRadius(x, y, phase, angle, 360) * (sp / 2) * 0.95 * amp;
      if (rad > 0.4) dots.push(<circle key={r * cols + c} cx={x} cy={y} r={rad.toFixed(2)} />);
    }
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", ...p.style }}>
      <defs>
        <linearGradient id={`ht-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2={h}>
          <stop offset="0" stopColor={theme.color.accent} />
          <stop offset="1" stopColor={theme.color.accent2} />
        </linearGradient>
      </defs>
      <g fill={`url(#ht-${uid})`}>{dots}</g>
    </svg>
  );
}
