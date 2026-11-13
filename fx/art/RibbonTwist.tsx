import { withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { toPath } from "../data/geom";
import type { Pt } from "../data/geom";

export type RibbonTwistProps = FxProps & { segments?: number; twists?: number; ribbonWidth?: number };

/** Cuadrilatero del tramo `k` de la cinta: su semiancho es `cos(angulo de giro)` por el semiancho total. */
export function ribbonQuad(a: Pt, b: Pt, twistA: number, twistB: number, half: number): { quad: Pt[]; front: boolean; shade: number } {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const ha = Math.cos(twistA) * half, hb = Math.cos(twistB) * half;
  const m = Math.cos((twistA + twistB) / 2);
  return {
    quad: [{ x: a.x + nx * ha, y: a.y + ny * ha }, { x: b.x + nx * hb, y: b.y + ny * hb }, { x: b.x - nx * hb, y: b.y - ny * hb }, { x: a.x - nx * ha, y: a.y - ny * ha }],
    front: m >= 0,
    shade: 1 - Math.abs(m),
  };
}

/** Cinta que se retuerce a lo largo de una curva y muestra una cara y la otra. */
export function RibbonTwist(p: RibbonTwistProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 560 });
  const dur = p.duration ?? 80;
  const N = p.segments ?? 140;
  const twists = p.twists ?? 3;
  const half = (p.ribbonWidth ?? 110) / 2;
  const t = progress(local, 0, dur);
  const reveal = Easing.inOut(progress(t, 0, 0.8));
  const phase = (1 - Easing.out(t)) * Math.PI * 2;
  const margin = 70;
  const center = (s: number): Pt => ({ x: margin + (w - margin * 2) * s, y: h / 2 + Math.sin(s * Math.PI * 2.2 + 0.4) * h * 0.24 });
  const upto = Math.max(1, Math.round(N * reveal));
  const pts = Array.from({ length: N + 1 }, (_, i) => center(i / N));
  const tw = (i: number) => (i / N) * Math.PI * 2 * twists + phase;
  const quads = [];
  for (let k = 0; k < upto; k++) {
    if (reveal <= 0) break;
    const q = ribbonQuad(pts[k]!, pts[k + 1]!, tw(k), tw(k + 1), half);
    const fill = q.front ? theme.color.accent : theme.color.accent2;
    quads.push(
      <g key={k}>
        <path d={toPath(q.quad, true)} fill={fill} stroke={fill} strokeWidth={1} />
        {q.shade > 0.02 && <path d={toPath(q.quad, true)} fill={withAlpha(theme.color.text, 0.32 * q.shade)} />}
      </g>,
    );
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", ...p.style }}>
      {quads}
    </svg>
  );
}
