import { useMemo } from "react";
import { withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { parsePath, toPath, trimPolyline } from "../data/geom";
import { staggerT } from "../data/geom";

export type LogoLandProps = FxProps & {
  /** Trazos de la marca (datos de trazado SVG en una caja de 200 x 200). */
  paths?: string[];
  /** Punto que cae (en la misma caja de 200 x 200). */
  dot?: { x: number; y: number; r: number };
  strokeWidth?: number;
};

const MARK = ["M44 160 V86 A56 56 0 0 1 156 86 V160"];
const DOT = { x: 100, y: 122, r: 17 };

/** Fases del efecto: trazos, caida, impacto (aplastamiento) y onda. Todas en 0..1. */
export function landPhases(t: number) {
  return {
    strokes: progress(t, 0, 0.5, Easing.inOut),
    drop: progress(t, 0.5, 0.17, Easing.in),
    squash: progress(t, 0.67, 0.2),
    ring: progress(t, 0.67, 0.33, Easing.out),
  };
}

/** Una marca que se dibuja a traves de una mascara y un punto que cae, se aplasta y se asienta con una onda. */
export function LogoLand(p: LogoLandProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 520, height: 520 });
  const dur = p.duration ?? 80;
  const paths = p.paths ?? MARK;
  const uid = `ll${Math.round(Math.min(Math.max(local, 0), dur) * 10)}n${paths.length}`;
  const dot = p.dot ?? DOT;
  const sw = p.strokeWidth ?? 24;
  const ph = landPhases(progress(local, 0, dur));
  const polys = useMemo(() => paths.map((d) => parsePath(d, 24).flat()), [paths]);
  const scale = Math.min(w, h) / 200;
  const n = polys.length;
  // dot
  const fall = 1 - ph.drop;
  const dy = -(dot.y + dot.r + 40) * fall * fall;
  const sq = Easing.lands(ph.squash);
  const sy = ph.squash <= 0 ? 1 : 0.55 + 0.45 * sq, sx = ph.squash <= 0 ? 1 : 1.4 - 0.4 * sq;
  const bottom = dot.y + dot.r;
  const showDot = ph.drop > 0;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w / scale} ${h / scale}`} style={{ display: "block", ...p.style }}>
      <defs>
        <linearGradient id={`lg-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="200">
          <stop offset="0" stopColor={theme.color.accent} />
          <stop offset="1" stopColor={theme.color.accent2} />
        </linearGradient>
        <mask id={`mk-${uid}`} maskUnits="userSpaceOnUse" x="-20" y="-20" width="260" height="260" style={{ maskType: "alpha" }}>
          {polys.map((pl, i) => {
            const tr = trimPolyline(pl, Easing.inOut(staggerT(ph.strokes, i, n, n > 1 ? 0.5 : 0)));
            return tr.length > 1 ? <path key={i} d={toPath(tr)} fill="none" stroke={theme.color.text} strokeWidth={sw + 8} strokeLinecap="round" strokeLinejoin="round" /> : null;
          })}
        </mask>
      </defs>
      <g mask={`url(#mk-${uid})`}>
        {paths.map((d, i) => <path key={i} d={d} fill="none" stroke={`url(#lg-${uid})`} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />)}
      </g>
      {ph.ring > 0 && ph.ring < 1 && <circle cx={dot.x} cy={bottom - dot.r} r={dot.r * (1 + ph.ring * 4)} fill="none" stroke={withAlpha(theme.color.accent2, 0.7 * (1 - ph.ring))} strokeWidth={5 * (1 - ph.ring) + 0.5} />}
      {showDot && (
        <g transform={`translate(${dot.x} ${bottom + dy}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-dot.x} ${-bottom})`}>
          <circle cx={dot.x} cy={dot.y} r={dot.r} fill={theme.color.accent2} />
        </g>
      )}
    </svg>
  );
}
