import { cornerRadius, staggerScale, withAlpha } from "../../themes";
import { Easing, random } from "../../engine";
import { chartColor, fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { SvgShadow, parseSurface } from "../data/styleKit";

export type TileGridProps = FxProps & {
  cols?: number;
  rows?: number;
  /** Fraccion de baldosas que quedan encendidas. */
  lit?: number;
};

/** Demora (0..spread) y si queda encendida, por baldosa; determinista segun la semilla. */
export function tilePlan(i: number, seed: string | number, lit: number, spread: number): { delay: number; on: boolean } {
  return { delay: random(`${seed}:d:${i}`) * spread, on: random(`${seed}:l:${i}`) < lit };
}

/** Grilla de baldosas que se dan vuelta y se encienden con un escalonado sembrado. */
export function TileGrid(p: TileGridProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 560 });
  const cols = p.cols ?? 8, rows = p.rows ?? 5;
  const dur = p.duration ?? 70;
  const seed = p.seed ?? "tiles";
  const gap = 12;
  const tw = (w - gap * (cols - 1)) / cols, th = (h - gap * (rows - 1)) / rows;
  // Estilo del diseño: superficie y esquinas de la baldosa, y paso entre baldosas (`motion.stagger`).
  const surf = parseSurface(theme, "card");
  const rx = cornerRadius(theme, "control");
  const spread = Math.min(0.95, 0.6 * staggerScale(theme));
  const t = progress(local, 0, dur);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", ...p.style }}>
      {Array.from({ length: cols * rows }, (_, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const plan = tilePlan(i, seed, p.lit ?? 0.3, spread);
        const f = progress(t, plan.delay, 1 - spread);
        const sx = Math.abs(Math.cos(Math.PI * Easing.inOut(f)));
        const back = f >= 0.5;
        const x = c * (tw + gap), y = r * (th + gap), cx = x + tw / 2;
        const col = chartColor(theme, c + r);
        const fill = !back ? surf.fill : plan.on ? col : theme.color.surfaceAlt;
        const ring = plan.on && f > 0.5 && f < 1 ? Math.sin(Math.PI * ((f - 0.5) * 2)) : 0;
        return (
          <g key={i} transform={`translate(${cx} 0) scale(${sx.toFixed(4)} 1) translate(${-cx} 0)`}>
            {ring > 0 && <rect x={x - 6 * ring} y={y - 6 * ring} width={tw + 12 * ring} height={th + 12 * ring} rx={rx + 4} fill="none" stroke={withAlpha(col, 0.5 * ring)} strokeWidth={4} />}
            <SvgShadow shadow={surf.shadow} x={x} y={y} width={tw} height={th} rx={rx} />
            <rect x={x} y={y} width={tw} height={th} rx={rx} fill={fill} stroke={(back && plan.on) || surf.border <= 0 ? "none" : surf.edge} strokeWidth={1.5 * surf.border} />
          </g>
        );
      })}
    </svg>
  );
}
