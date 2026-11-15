import type React from "react";
import { numeralStyle, staggerScale, withAlpha, textStyle } from "../../themes";
import { Easing } from "../../engine";
import { fade, fxBox, fxDensity, progress, styleKey, svgScale, useFx } from "../core";
import type { FxProps } from "../core";
import { pointAt, roundedPolyline, toPath, trimPolyline } from "./geom";
import type { Pt } from "./geom";
import { SvgShadow, svgSurface } from "./styleKit";

export type StepState = "done" | "active" | "pending";
export type FlowStep = { title: string; caption?: string; state?: StepState };
export type FlowStepsProps = FxProps & {
  steps?: FlowStep[];
  /** Indice activo si los pasos no traen `state`: antes = done, despues = pending. */
  activeIndex?: number;
};

const DEFAULT: FlowStep[] = [
  { title: "Recibir", caption: "Entra el pedido" },
  { title: "Revisar", caption: "Chequeo de datos" },
  { title: "Preparar", caption: "Armado del paquete" },
  { title: "Entregar", caption: "Salida al destino" },
];

/** Tarjetas en escalera unidas por un conector redondeado que se dibuja; cada tarjeta con su estado. */
export function FlowSteps(p: FlowStepsProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 1100, height: 620 });
  // `density` (fx/core/density.ts): tarjetas, márgenes, trazos y letra bajan juntos en una caja chica; sin él, k = 1 (el de siempre)
  const k = fxDensity(p.density, { width: w, height: h }, { width: 1100, height: 620 });
  const steps = p.steps ?? DEFAULT;
  const n = steps.length;
  const dur = p.duration ?? 75;
  const active = p.activeIndex ?? Math.min(n - 1, 2);
  const cw = Math.min(300 * k, (w - 40 * k) / (n * 0.75 + 0.25)), ch = 130 * k;
  const dx = (w - cw - 20 * k) / Math.max(1, n - 1), dy = (h - ch - 20 * k) / Math.max(1, n - 1);
  const cards = steps.map((_, i) => ({ x: 10 * k + i * dx, y: 10 * k + i * dy }));
  // conector: baja desde el centro inferior de una tarjeta y entra por el borde izquierdo de la siguiente (pasa por debajo de las tarjetas)
  // arma el camino como segmentos que pasan por debajo de las tarjetas (se dibujan antes que ellas)
  const path: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = cards[i]!, b = cards[i + 1]!;
    if (i === 0) path.push({ x: a.x + cw * 0.5, y: a.y + ch });
    path.push({ x: a.x + cw * 0.5, y: b.y + ch / 2 });
    path.push({ x: b.x, y: b.y + ch / 2 });
    if (i < n - 2) path.push({ x: b.x + cw * 0.5, y: b.y + ch / 2 }, { x: b.x + cw * 0.5, y: b.y + ch });
  }
  const full = path.length > 1 ? roundedPolyline(dedupe(path), 28 * k, 8) : [];
  const draw = progress(local, dur * 0.05, dur * 0.8, Easing.inOut);
  const tr = trimPolyline(full, draw);
  const tip = full.length ? pointAt(full, draw) : { x: 0, y: 0 };
  const fs = theme.type.eyebrow * k;
  // Estilo del diseño: esquinas del panel (`radius.panel` con el estilo por defecto), superficie (relleno y sombra), número de paso y paso entre tarjetas.
  const surf = svgSurface(theme, "panel");
  const rx = k === 1 ? surf.radius : Math.min(surf.radius, ch / 2);
  const num = numeralStyle(theme, { on: theme.color.surface });
  const numFill = "background" in num ? null : "WebkitTextStroke" in num ? "outline" : String(num.color);
  const stag = Math.min(0.95, 0.8 * staggerScale(theme));
  // Número de paso según `type.numerals`: `gradient` (por defecto) conserva el color del estado; el paso pendiente siempre queda atenuado.
  const numAttrs = (state: StepState, col: string): React.SVGAttributes<SVGTextElement> => {
    if (numFill === null || state === "pending") return { fill: col };
    if (numFill === "outline") return { fill: "none", stroke: theme.color.accent, strokeWidth: 2 * k };
    return { fill: numFill };
  };
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      {full.length > 1 && <path d={toPath(full)} fill="none" stroke={theme.color.border} strokeWidth={6 * k} strokeLinecap="round" strokeLinejoin="round" />}
      {tr.length > 1 && <path d={toPath(tr)} fill="none" stroke={theme.color.accent} strokeWidth={6 * k} strokeLinecap="round" strokeLinejoin="round" />}
      {draw > 0 && draw < 1 && <circle cx={tip.x} cy={tip.y} r={9 * k} fill={theme.color.accent} />}
      {steps.map((s, i) => {
        const c = cards[i]!;
        const state: StepState = s.state ?? (i < active ? "done" : i === active ? "active" : "pending");
        // la tarjeta aparece cuando el trazo llega a ella
        const reach = i === 0 ? 0 : (i / (n - 1)) * stag;
        const t = Easing.lands(progress(local, dur * (0.02 + reach * 0.9), dur * 0.18));
        const col = state === "done" ? theme.color.success : state === "active" ? theme.color.accent : theme.color.textMuted;
        const cx = c.x + cw / 2, cy = c.y + ch / 2;
        const sc = 0.85 + 0.15 * Math.min(1.05, t);
        // opacidad y escala solo mientras la tarjeta aterriza (en reposo no queda `scale(1)`)
        const gp = { opacity: fade(Math.min(1, t * 1.6)), transform: svgScale(cx, cy, sc) };
        return (
          <g key={`${i}:${styleKey(gp)}`} {...gp} textRendering="geometricPrecision">
            <SvgShadow shadow={surf.shadow} x={c.x} y={c.y} width={cw} height={ch} rx={rx} />
            <rect x={c.x} y={c.y} width={cw} height={ch} rx={rx} fill={surf.fill} stroke={state === "pending" ? theme.color.border : col} strokeWidth={(state === "active" ? 4 : 2.5) * k} strokeDasharray={state === "pending" ? `${10 * k} ${8 * k}` : undefined} />
            <circle cx={c.x + 44 * k} cy={cy} r={22 * k} fill={state === "pending" ? "none" : state === "done" ? col : withAlpha(col, 0.15)} stroke={col} strokeWidth={3 * k} />
            {state === "done" ? <path d={`M${c.x + 34 * k} ${cy} l${7 * k} ${8 * k} l${13 * k} ${-16 * k}`} fill="none" stroke={theme.color.onAccent} strokeWidth={4 * k} strokeLinecap="round" strokeLinejoin="round" /> : <text x={c.x + 44 * k} y={cy + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={textStyle(theme, "label", { strong: true }).fontWeight} {...numAttrs(state, col)}>{i + 1}</text>}
            <text x={c.x + 84 * k} y={cy - 4 * k} fontSize={fs * 1.1} fontWeight={textStyle(theme, "label", { strong: true }).fontWeight} fill={state === "pending" ? theme.color.textMuted : theme.color.text}>{s.title}</text>
            {s.caption && <text x={c.x + 84 * k} y={cy + fs * 0.95} fontSize={fs * 0.8} fill={theme.color.textMuted}>{s.caption}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function dedupe(pts: Pt[]): Pt[] {
  return pts.filter((q, i) => i === 0 || Math.hypot(q.x - pts[i - 1]!.x, q.y - pts[i - 1]!.y) > 0.5);
}
