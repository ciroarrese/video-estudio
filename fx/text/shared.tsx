import React from "react";
import { resolveStyle, textStyle } from "../../themes";
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
  /** Peso; por defecto el de titulares del design system (`style.type.titleWeight`; `semibold` con el estilo por defecto). */
  weight?: number;
  align?: "left" | "center" | "right";
};

/**
 * Tratamiento de titular del design system para los efectos que hoy usan `semibold`: peso (`textStyle(theme, "title")`) e
 * interletrado en em (`style.type.titleTracking`). Un `weight` explícito gana y, con él, el efecto no suma interletrado (el peso lo
 * eligió quien llama). Con el estilo por defecto: `semibold` y 0.
 */
export function titleTreatment(theme: Theme, weight?: number): { weight: number; tracking: number } {
  if (weight !== undefined) return { weight, tracking: 0 };
  return { weight: textStyle(theme, "title").fontWeight as number, tracking: resolveStyle(theme).type.titleTracking };
}

export function baseText(
  theme: Theme,
  p: { fontSize?: number; color?: ColorRole; weight?: number; align?: "left" | "center" | "right" },
  /** `true` en los efectos de titular (`MaskedRise`, `ScrambleDecode`, `Typewriter`): peso e interletrado del design system. */
  title = false,
): React.CSSProperties {
  const tt = title ? titleTreatment(theme, p.weight) : null;
  return {
    fontFamily: theme.font.family,
    fontSize: p.fontSize ?? theme.type.h1,
    fontWeight: tt ? tt.weight : p.weight ?? theme.font.weights.semibold,
    ...(tt && tt.tracking !== 0 ? { letterSpacing: `${+tt.tracking.toFixed(3)}em` } : {}),
    color: roleColor(theme, p.color ?? "text"),
    textAlign: p.align ?? "left",
    lineHeight: 1.15,
    whiteSpace: "nowrap",
  };
}

export const px = (n: number) => `${Math.round(n * 100) / 100}px`;
