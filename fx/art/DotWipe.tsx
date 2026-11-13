import { Easing } from "../../engine";
import { fxBox, progress, roleColor, useFx } from "../core";
import type { ColorRole, FxProps } from "../core";

export type DotWipeProps = FxProps & {
  /** `in`: crece hasta llenar el cuadro (entrada); `out`: se achica desde el cuadro lleno (salida); `inout`: ambas. */
  mode?: "in" | "out" | "inout";
  /** Centro del punto como fraccion del cuadro (0..1). */
  cx?: number;
  cy?: number;
  color?: ColorRole;
  /** Color del anillo que va delante. */
  edge?: ColorRole;
};

/** Radio necesario para cubrir una caja desde (x, y): distancia a la esquina mas lejana. */
export function coverRadius(w: number, h: number, x: number, y: number): number {
  return Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
}

/** Fraccion del radio de cobertura (0..1) segun el modo y el progreso. */
export function wipeFraction(mode: "in" | "out" | "inout", t: number): number {
  const k = Math.min(1, Math.max(0, t));
  if (mode === "in") return Easing.inOut(k);
  if (mode === "out") return 1 - Easing.inOut(k);
  return Easing.inOut(Math.min(1, k / 0.45)) - Easing.inOut(Math.max(0, (k - 0.55) / 0.45));
}

/** Un punto que crece hasta cubrir el cuadro; sirve de transicion de escena (entrada y salida). */
export function DotWipe(p: DotWipeProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 1920, height: 1080 });
  const dur = p.duration ?? 40;
  const mode = p.mode ?? "inout";
  const x = (p.cx ?? 0.5) * w, y = (p.cy ?? 0.5) * h;
  const R = coverRadius(w, h, x, y) * 1.02;
  const t = progress(local, 0, dur);
  const f = wipeFraction(mode, t);
  // el segundo disco llega un poco atras: se ve un borde de color
  const f2 = Math.max(0, f - 0.06);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", ...p.style }}>
      {f > 0.001 && <circle cx={x} cy={y} r={f * R} fill={roleColor(theme, p.edge ?? "accent2")} />}
      {f2 > 0.001 && <circle cx={x} cy={y} r={f2 * R} fill={roleColor(theme, p.color ?? "accent")} />}
    </svg>
  );
}
