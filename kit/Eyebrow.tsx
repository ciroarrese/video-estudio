import React from "react";
import { textStyle, useTheme } from "../themes";

/**
 * Rótulo pequeño del tamaño `type.eyebrow` (subtítulos, etiquetas de una tarjeta, líneas de apoyo). Toma del design system la caja
 * (`style.type.eyebrowCase`: `upper` pone mayúsculas) y el interletrado (`eyebrowTracking`), por `textStyle(theme, "eyebrow")`;
 * con el estilo por defecto no agrega nada al texto. El tamaño de letra no depende del estilo: `size` (px) solo existe para las
 * piezas que usan una fracción de `type.eyebrow`. Con mayúsculas el texto ensancha un 10 a 15 %: quien lo mide lo cuenta.
 */
export function Eyebrow({
  children,
  size,
  weight = "medium",
  color,
  style,
}: {
  children?: React.ReactNode;
  /** Tamaño de letra en px (por defecto `theme.type.eyebrow`). */
  size?: number;
  /** Peso: un nombre de `theme.font.weights` (por defecto `medium`). */
  weight?: "regular" | "medium" | "semibold" | "stat";
  /** Rol de color: `color.textMuted` por defecto. */
  color?: string;
  style?: React.CSSProperties;
}) {
  const theme = useTheme();
  return (
    <span style={{ fontSize: size ?? theme.type.eyebrow, fontWeight: theme.font.weights[weight], color: color ?? theme.color.textMuted, ...textStyle(theme, "eyebrow"), ...style }}>
      {children}
    </span>
  );
}
