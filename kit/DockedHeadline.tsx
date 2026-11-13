import { useTheme } from "../themes";
import { clamp, themeEasing, useFrameOr } from "./util";
import { kf } from "./kf";
import { GradientText } from "./GradientText";

/** Cuánto ocultar el titular según la escala de cámara: 0 en `threshold`, 1 en `threshold + range`. */
export function hideFromScale(scale: number, threshold = 1, range = 0.08): number {
  return clamp((scale - threshold) / range, 0, 1);
}

/** Píldora arriba a la izquierda con el titular de la escena; se aparta (fundido) cuando `hide` va de 0 a 1. */
export function DockedHeadline({
  index,
  title,
  subtitle,
  frame,
  start = 0,
  hide = 0,
}: {
  index: number;
  title: string;
  subtitle?: string;
  frame?: number;
  start?: number;
  hide?: number;
}) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const a = kf(f, [start, start + 18], [0, 1], themeEasing(theme.motion.easing.out)) * (1 - clamp(hide, 0, 1));
  if (a <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: theme.safe.x / 2,
        top: theme.safe.y / 2,
        display: "flex",
        alignItems: "center",
        gap: theme.type.caption * 0.5,
        padding: `${theme.type.eyebrow * 0.45}px ${theme.type.caption * 0.9}px ${theme.type.eyebrow * 0.45}px ${theme.type.eyebrow * 0.5}px`,
        borderRadius: theme.radius.pill,
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        boxShadow: theme.shadow.md,
        opacity: a,
        transform: `translateX(${(1 - a) * -30}px)`,
        zIndex: 90,
      }}
    >
      <GradientText style={{ fontSize: theme.type.caption, fontWeight: theme.font.weights.stat }}>{String(index).padStart(2, "0")}</GradientText>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: theme.type.caption, fontWeight: theme.font.weights.semibold, color: theme.color.text, lineHeight: 1.15 }}>{title}</span>
        {subtitle && <span style={{ fontSize: theme.type.eyebrow * 0.85, color: theme.color.textMuted, lineHeight: 1.2 }}>{subtitle}</span>}
      </div>
    </div>
  );
}
