import React from "react";
import { resolveStyle, useTheme } from "../themes";
import { useFrameOr } from "./util";

/**
 * Texto con el degradado de marca del tema.
 * Con `loop` (largo del ciclo en cuadros) el degradado hace un vaivén por ciclo y vuelve exacto al punto de partida: es lo que conviene para una cuenta o un cierre que se repite.
 * Con `pan` (velocidad; 1 = un vaivén cada ~125 cuadros) oscila sin saltos pero sin ciclo exacto; `loop` tiene prioridad.
 * Sin `loop` ni `pan`, el vaivén sale de `style.decor.gradientLoop` del tema (0 = quieto).
 * Ambos salen solo del cuadro y la posición se redondea a centésimas, así que pasan `--check`.
 */
export function GradientText({
  children,
  frame,
  pan = 0,
  loop,
  style,
}: {
  children?: React.ReactNode;
  frame?: number;
  pan?: number;
  /** Cuadros de un vaivén completo (mayor que 0). */
  loop?: number;
  style?: React.CSSProperties;
}) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  // `loop` explícito > `pan` explícito > vaivén del design system
  const lp = loop ?? (pan === 0 ? resolveStyle(theme).decor.gradientLoop : undefined);
  const panning = (lp !== undefined && lp > 0) || pan !== 0;
  const phase = lp !== undefined && lp > 0 ? Math.sin(((f % lp) / lp) * Math.PI * 2) : Math.sin(f * pan * 0.05);
  const pos = panning ? `${+(50 + 50 * phase).toFixed(2)}% 0` : "0% 0";
  return (
    <span
      style={{
        background: theme.gradient.brand,
        backgroundSize: panning ? "200% 100%" : "100% 100%",
        backgroundPosition: pos,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
