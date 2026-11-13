import { withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { pointAt, roundedPolyline, toPath, trimPolyline } from "./geom";
import type { Pt } from "./geom";

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
  const steps = p.steps ?? DEFAULT;
  const n = steps.length;
  const dur = p.duration ?? 75;
  const active = p.activeIndex ?? Math.min(n - 1, 2);
  const cw = Math.min(300, (w - 40) / (n * 0.75 + 0.25)), ch = 130;
  const dx = (w - cw - 20) / Math.max(1, n - 1), dy = (h - ch - 20) / Math.max(1, n - 1);
  const cards = steps.map((_, i) => ({ x: 10 + i * dx, y: 10 + i * dy }));
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
  const full = path.length > 1 ? roundedPolyline(dedupe(path), 28, 8) : [];
  const draw = progress(local, dur * 0.05, dur * 0.8, Easing.inOut);
  const tr = trimPolyline(full, draw);
  const tip = full.length ? pointAt(full, draw) : { x: 0, y: 0 };
  const fs = theme.type.eyebrow;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      {full.length > 1 && <path d={toPath(full)} fill="none" stroke={theme.color.border} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />}
      {tr.length > 1 && <path d={toPath(tr)} fill="none" stroke={theme.color.accent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />}
      {draw > 0 && draw < 1 && <circle cx={tip.x} cy={tip.y} r={9} fill={theme.color.accent} />}
      {steps.map((s, i) => {
        const c = cards[i]!;
        const state: StepState = s.state ?? (i < active ? "done" : i === active ? "active" : "pending");
        // la tarjeta aparece cuando el trazo llega a ella
        const reach = i === 0 ? 0 : (i / (n - 1)) * 0.8;
        const t = Easing.lands(progress(local, dur * (0.02 + reach * 0.9), dur * 0.18));
        const col = state === "done" ? theme.color.success : state === "active" ? theme.color.accent : theme.color.textMuted;
        const cx = c.x + cw / 2, cy = c.y + ch / 2;
        const sc = 0.85 + 0.15 * Math.min(1.05, t);
        return (
          <g key={i} opacity={Math.min(1, t * 1.6)} transform={`translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`}>
            <rect x={c.x} y={c.y} width={cw} height={ch} rx={theme.radius.panel} fill={theme.color.surface} stroke={state === "pending" ? theme.color.border : col} strokeWidth={state === "active" ? 4 : 2.5} strokeDasharray={state === "pending" ? "10 8" : undefined} />
            <circle cx={c.x + 44} cy={cy} r={22} fill={state === "pending" ? "none" : state === "done" ? col : withAlpha(col, 0.15)} stroke={col} strokeWidth={3} />
            {state === "done" ? <path d={`M${c.x + 34} ${cy} l7 8 l13 -16`} fill="none" stroke={theme.color.onAccent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /> : <text x={c.x + 44} y={cy + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={theme.font.weights.semibold} fill={col}>{i + 1}</text>}
            <text x={c.x + 84} y={cy - 4} fontSize={fs * 1.1} fontWeight={theme.font.weights.semibold} fill={state === "pending" ? theme.color.textMuted : theme.color.text}>{s.title}</text>
            {s.caption && <text x={c.x + 84} y={cy + fs * 0.95} fontSize={fs * 0.8} fill={theme.color.textMuted}>{s.caption}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function dedupe(pts: Pt[]): Pt[] {
  return pts.filter((q, i) => i === 0 || Math.hypot(q.x - pts[i - 1]!.x, q.y - pts[i - 1]!.y) > 0.5);
}
