import { doodleStyle, staggerScale, withAlpha, textStyle } from "../../themes";
import { Easing, random } from "../../engine";
import { fade, fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { staggerT, toPath } from "../data/geom";
import type { Pt } from "../data/geom";
import { svgSurface } from "../data/styleKit";

export type Strip = { text: string; x: number; y: number; w: number; h: number; rot: number; from: "left" | "right" | "top" | "bottom" };
export type PaperCollageProps = FxProps & { strips?: Strip[] };

const DEFAULT: Strip[] = [
  { text: "ideas", x: 170, y: 120, w: 340, h: 112, rot: -5, from: "left" },
  { text: "recortes", x: 420, y: 250, w: 380, h: 112, rot: 3, from: "right" },
  { text: "color", x: 230, y: 380, w: 300, h: 108, rot: -2.5, from: "bottom" },
  { text: "papel", x: 560, y: 90, w: 230, h: 100, rot: 6, from: "top" },
];

/** Contorno de una tira de papel rasgado (bordes superior e inferior irregulares, sembrados). */
export function tornStrip(w: number, h: number, seed: string | number, amp = 7): Pt[] {
  const n = Math.max(6, Math.round(w / 16));
  const j = (k: string) => random(`${seed}:${k}`) * amp;
  const top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    top.push({ x: (w * i) / n, y: j(`t${i}`) });
    bot.push({ x: (w * (n - i)) / n, y: h - j(`b${i}`) });
  }
  return [...top, ...bot];
}

/** Tiras de papel rasgado que llegan en momentos distintos, se pasan unos grados y se asientan; al final cae la cinta. */
export function PaperCollage(p: PaperCollageProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 560 });
  const strips = p.strips ?? DEFAULT;
  const n = strips.length;
  const dur = p.duration ?? 80;
  const seed = p.seed ?? "collage";
  const t = progress(local, 0, dur * 0.82);
  // Estilo del diseño: superficie de la tira (relleno, borde, sombra: suave = la desplazada de siempre, filo duro = tinta, plana = ninguna) y rasgado
  // (`decor.doodleStroke`: a mano = irregular; geométrico = corte casi limpio).
  const surf = svgSurface(theme, "card");
  const amp = doodleStyle(theme).jitter ? 7 : 2.5;
  const paper = [
    { fill: surf.fill, ink: theme.color.text },
    { fill: theme.color.accent, ink: theme.color.onAccent },
    { fill: theme.color.surfaceAlt, ink: theme.color.text },
    { fill: theme.color.accent2, ink: theme.color.onAccent },
  ];
  const tape = Easing.lands(progress(local, dur * 0.8, dur * 0.2));
  const tapeScale = +(1.6 - 0.6 * Math.min(1.05, tape)).toFixed(4);
  const last = strips[n - 1]!;
  const fs = theme.type.h2 * 0.8;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      {strips.map((s, i) => {
        const e = Easing.lands(staggerT(t, i, n, Math.min(0.95, 0.6 * staggerScale(theme))));
        if (e <= 0) return null;
        // La tira viaja solo hasta donde cabe dentro del cuadro (con margen por el giro) y aparece con un fundido: nunca queda cortada por el borde.
        const m = 28;
        const room = { left: s.x - m, right: w - (s.x + s.w) - m, top: s.y - m, bottom: h - (s.y + s.h) - m }[s.from];
        const d = Math.max(0, room);
        const from = { left: [-d, 0], right: [d, 0], top: [0, -d], bottom: [0, d] }[s.from];
        const dx = from[0]! * (1 - e), dy = from[1]! * (1 - e);
        const rot = s.rot + (1 - e) * (i % 2 === 0 ? -22 : 22);
        const poly = toPath(tornStrip(s.w, s.h, `${seed}:${i}`, amp), true);
        const col = paper[i % paper.length]!;
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        return (
          <g key={`${i}${fade(Math.min(1, e * 2.5)) === undefined ? "" : "o"}`} opacity={fade(Math.min(1, e * 2.5))} transform={`translate(${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)}) rotate(${rot.toFixed(3)}) translate(${-s.w / 2} ${-s.h / 2})`}>
            {surf.shadow.shadow === "hard" ? <path d={poly} transform={`translate(${surf.shadow.dx + 2} ${surf.shadow.dy + 2})`} fill={surf.shadow.color} /> : surf.shadow.shadow === "soft" && <path d={poly} transform="translate(5 7)" fill={withAlpha(theme.color.text, 0.16)} />}
            {surf.shadow.shadow === "glow" && <path d={poly} fill="none" stroke={surf.shadow.color} strokeWidth={14} strokeLinejoin="round" opacity={0.35} />}
            <path d={poly} fill={col.fill} stroke={surf.border > 0 ? surf.edge : "none"} strokeWidth={1.5 * surf.border} />
            <text x={s.w / 2} y={s.h / 2 + fs * 0.33} textAnchor="middle" fontSize={fs} fontWeight={textStyle(theme, "label", { strong: true }).fontWeight} fill={col.ink} style={{ color: col.ink }}>{s.text}</text>
          </g>
        );
      })}
      {tape > 0 && (
        <g key={`${tapeScale === 1 ? "" : "s"}${fade(Math.min(1, tape * 1.5)) === undefined ? "" : "o"}`} transform={`translate(${last.x + last.w * 0.12} ${last.y + 8}) rotate(-12)${tapeScale === 1 ? "" : ` scale(${tapeScale})`}`} opacity={fade(Math.min(1, tape * 1.5))}>
          <rect x={-60} y={-18} width={120} height={36} fill={withAlpha(theme.color.warning, 0.65)} stroke={withAlpha(theme.color.warning, 0.9)} strokeWidth={1.5} />
        </g>
      )}
    </svg>
  );
}
