import { doodleStyle, textStyle, withAlpha } from "../../themes";
import { Easing, random } from "../../engine";
import { fxBox, progress, roleColor, useFx } from "../core";
import type { ColorRole, FxProps } from "../core";
import { catmullRom, toPath, trimPolyline } from "../data/geom";
import type { Pt } from "../data/geom";

export type MarkerKind = "highlight" | "underline" | "circle" | "scribble";
export type MarkerDrawProps = FxProps & {
  text?: string;
  kind?: MarkerKind;
  color?: ColorRole;
};

/** Puntos del trazo de marcador dentro de una caja w x h, con temblor sembrado. */
export function markerPoints(kind: MarkerKind, w: number, h: number, seed: string | number, jitter = true): Pt[] {
  const wob = (i: number, amp: number) => (jitter ? (random(`${seed}:${kind}:${i}`) - 0.5) * 2 * amp : 0);
  const pts: Pt[] = [];
  if (kind === "highlight") {
    const n = 8;
    for (let i = 0; i <= n; i++) pts.push({ x: w * 0.02 + (w * 0.96 * i) / n, y: h / 2 + wob(i, h * 0.035) });
  } else if (kind === "underline") {
    const n = 8;
    for (let i = 0; i <= n; i++) pts.push({ x: w * 0.03 + (w * 0.94 * i) / n, y: h * 0.88 + wob(i, h * 0.03) - (i / n) * h * 0.03 });
  } else if (kind === "circle") {
    const n = 28, turns = 1.12;
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI * 0.6 + (i / n) * Math.PI * 2 * turns;
      const grow = 1 + (i / n) * 0.07;
      pts.push({ x: w / 2 + Math.cos(a) * w * 0.5 * 0.94 * grow + wob(i, w * 0.01), y: h / 2 + Math.sin(a) * h * 0.5 * 0.94 * grow + wob(i + 100, h * 0.02) });
    }
  } else {
    const passes = 5;
    for (let i = 0; i <= passes * 2; i++) {
      const left = i % 2 === 0;
      pts.push({ x: (left ? w * 0.04 : w * 0.96) + wob(i, w * 0.01), y: h * 0.12 + (h * 0.76 * i) / (passes * 2) + wob(i + 50, h * 0.02) });
    }
  }
  return catmullRom(pts, kind === "scribble" ? 3 : 8);
}

/** Trazos gruesos de marcador (resaltar, subrayar, encerrar) con temblor sembrado, sobre un texto. */
export function MarkerDraw(p: MarkerDrawProps) {
  const { local, theme, style } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 560, height: 160 });
  // Estilo del diseño: trazo a mano (con temblor) o geométrico (limpio) y, para el resalte, lo que dice `type.highlight`: con `underline` el
  // resalte se dibuja como filete bajo la palabra; con el resto, el marcador translúcido de siempre.
  const jitter = doodleStyle(theme).jitter;
  const tw = textStyle(theme, "title");
  const asUnderline = style.type.highlight === "underline";
  const kind = (p.kind ?? "highlight") === "highlight" && asUnderline ? "underline" : p.kind ?? "highlight";
  const dur = p.duration ?? 40;
  const color = roleColor(theme, p.color ?? ((p.kind ?? "highlight") === "highlight" && !asUnderline ? "warning" : "accent"));
  const t = Easing.inOut(progress(local, dur * 0.1, dur * 0.8));
  const pts = trimPolyline(markerPoints(kind, w, h, p.seed ?? "marker", jitter), t);
  const sw = kind === "highlight" ? h * 0.82 : kind === "underline" ? h * 0.11 : kind === "circle" ? h * 0.07 : h * 0.09;
  const alpha = kind === "highlight" ? 0.4 : 0.9;
  const stroke = pts.length > 1 ? <path d={toPath(pts)} fill="none" stroke={kind === "highlight" ? withAlpha(color, alpha) : color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" /> : null;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      {kind === "highlight" && stroke}
      <text x={w / 2} y={h / 2 + h * 0.2} textAnchor="middle" fontSize={h * 0.58} fontWeight={tw.fontWeight} {...(tw.letterSpacing ? { letterSpacing: tw.letterSpacing } : {})} fill={theme.color.text}>{p.text ?? "palabra clave"}</text>
      {kind !== "highlight" && stroke}
    </svg>
  );
}
