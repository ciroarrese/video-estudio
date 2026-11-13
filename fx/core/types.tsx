import React from "react";
import { useFrame } from "../../engine";
import { resolveStyle, useTheme } from "../../themes";
import type { Theme, ThemeColors, ThemeStyle } from "../../themes";

/** Roles de color del tema (sin la serie `chart`). Los efectos aceptan sobrescrituras con estos nombres. */
export type ColorRole = Exclude<keyof ThemeColors, "chart">;

/**
 * Convencion de props de todo efecto `fx`.
 * - `frame`: cuadro explicito; por defecto `useFrame()`.
 * - `start`: cuadro (del contexto) en que arranca el efecto; por defecto 0.
 * - `duration`: cuadros que dura la animacion hasta quedar compuesta; cada efecto trae un valor por defecto.
 * - `width`/`height` (o `size` cuadrado): caja logica en px; cada efecto trae un valor por defecto.
 * - `seed`: semilla del azar (siempre `random(seed...)`, nunca `Math.random`).
 * - Colores: del tema; las sobrescrituras se tipan con `ColorRole`.
 *
 * GARANTIA: el ULTIMO cuadro del efecto (`frame >= start + duration`) es una imagen fija compuesta y
 * legible por si sola; nada queda a medio camino. Por eso un efecto se puede congelar como still.
 */
export type FxProps = {
  frame?: number;
  start?: number;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
  seed?: string | number;
  style?: React.CSSProperties;
};

export type FxBox = { width: number; height: number };

/** Caja del efecto a partir de `width`/`height`/`size` y unos valores por defecto. */
export function fxBox(p: Pick<FxProps, "width" | "height" | "size">, def: FxBox): FxBox {
  return { width: p.width ?? p.size ?? def.width, height: p.height ?? p.size ?? def.height };
}

/** Cuadro absoluto, cuadro local (desde `start`), tema y estilo resuelto del tema (`resolveStyle(theme)`, completo) para un efecto. */
export function useFx(p: Pick<FxProps, "frame" | "start">): { frame: number; local: number; theme: Theme; style: ThemeStyle } {
  const ctx = useFrame();
  const theme = useTheme();
  const frame = p.frame ?? ctx;
  return { frame, local: frame - (p.start ?? 0), theme, style: resolveStyle(theme) };
}

/** Color del tema por rol. */
export const roleColor = (theme: Theme, role: ColorRole): string => theme.color[role];

/** i-esimo color de la serie categorica del tema (cicla). */
export const chartColor = (theme: Theme, i: number): string => theme.color.chart[((i % theme.color.chart.length) + theme.color.chart.length) % theme.color.chart.length]!;
