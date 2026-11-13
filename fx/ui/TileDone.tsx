import { withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { fxBox, progress, svgScale, useFx } from "../core";
import type { FxProps } from "../core";

export type TileDoneProps = FxProps & {
  label?: string;
  pendingText?: string;
  doneText?: string;
};

/** Baldosa de tarea que pasa a "hecha" en `start` con una onda (pensada para acompañar un clic de `Cursor`). */
export function TileDone(p: TileDoneProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 520, height: 170 });
  const dur = p.duration ?? 30;
  const t = progress(local, 0, dur);
  const flip = Easing.lands(progress(local, 0, dur * 0.4));
  const check = Easing.out(progress(local, dur * 0.15, dur * 0.4));
  const ripple = Easing.out(progress(local, 0, dur));
  const done = local >= 0 && t > 0.08;
  const press = local >= 0 && local < dur * 0.18 ? 1 - 0.03 * Math.sin((Math.PI * local) / (dur * 0.18)) : 1;
  const fs = theme.type.caption * 0.85;
  const cx = 70, cy = h / 2;
  const colBorder = done ? theme.color.success : theme.color.border;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", fontFamily: theme.font.family, ...p.style }}>
      <g key={svgScale(w / 2, h / 2, press) ? "p" : "r"} transform={svgScale(w / 2, h / 2, press)}>
        <rect x={6} y={6} width={w - 12} height={h - 12} rx={theme.radius.lg} fill={theme.color.surface} stroke={colBorder} strokeWidth={done ? 3 : 2} />
        {done && <rect x={6} y={6} width={w - 12} height={h - 12} rx={theme.radius.lg} fill={withAlpha(theme.color.success, 0.1 * Math.min(1, flip))} />}
        {t > 0 && t < 1 && <circle cx={cx} cy={cy} r={ripple * w * 0.5} fill="none" stroke={withAlpha(theme.color.success, 0.5 * (1 - ripple))} strokeWidth={6 * (1 - ripple) + 1} />}
        <circle key={done ? "d" : "p"} cx={cx} cy={cy} r={32 * (done ? 0.85 + 0.15 * Math.min(1.1, flip) : 1)} fill={done ? theme.color.success : "none"} stroke={done ? theme.color.success : theme.color.textMuted} strokeWidth={3.5} strokeDasharray={done ? undefined : "8 6"} />
        {done && <path d={`M${cx - 13} ${cy + 1} l10 11 l18 -22`} fill="none" stroke={theme.color.onAccent} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - check} />}
        <text x={126} y={cy - 4} fontSize={fs * 1.15} fontWeight={theme.font.weights.semibold} fill={theme.color.text}>{p.label ?? "Revisar informe"}</text>
        <text x={126} y={cy + fs * 1.1} fontSize={fs * 0.85} fill={done ? theme.color.success : theme.color.textMuted}>{done ? p.doneText ?? "Hecho" : p.pendingText ?? "Pendiente"}</text>
      </g>
    </svg>
  );
}
