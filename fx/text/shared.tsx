import React from "react";
import type { Theme } from "../../themes";
import { roleColor } from "../core";
import type { ColorRole, FxProps } from "../core";

/** Props comunes de los efectos de texto. */
export type TextFxProps = FxProps & {
  text: string;
  /** Tamano de letra en px; por defecto `theme.type.h1`. */
  fontSize?: number;
  /** Rol de color del texto; por defecto `text`. */
  color?: ColorRole;
  /** Peso; por defecto el `semibold` del tema. */
  weight?: number;
  align?: "left" | "center" | "right";
};

export function baseText(theme: Theme, p: { fontSize?: number; color?: ColorRole; weight?: number; align?: "left" | "center" | "right" }): React.CSSProperties {
  return {
    fontFamily: theme.font.family,
    fontSize: p.fontSize ?? theme.type.h1,
    fontWeight: p.weight ?? theme.font.weights.semibold,
    color: roleColor(theme, p.color ?? "text"),
    textAlign: p.align ?? "left",
    lineHeight: 1.15,
    whiteSpace: "nowrap",
  };
}

export const px = (n: number) => `${Math.round(n * 100) / 100}px`;
