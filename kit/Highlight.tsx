import React from "react";
import { highlightStyle, useTheme } from "../themes";
import { useFrameOr } from "./util";

/**
 * Palabra resaltada dentro de un texto, según `style.type.highlight`: `gradient` (el degradado de marca, con el vaivén de
 * `decor.gradientLoop`), `accent` (color de acento), `underline` (filete de acento) o `marker` (marcador translúcido detrás).
 * `progress` (0 a 1) va dibujando el filete o el marcador de izquierda a derecha; los otros dos aparecen completos.
 * Es en línea: va dentro de un párrafo o un titular y hereda su tamaño. Con `underline` y `marker` conviene que la palabra no se parta
 * en dos renglones (la pieza ya repite el trazo en cada renglón).
 */
export function Highlight({ children, frame, loop, progress, style }: { children?: React.ReactNode; frame?: number; loop?: number; progress?: number; style?: React.CSSProperties }) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  return <span style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", ...highlightStyle(theme, { frame: f, loop, progress }), ...style }}>{children}</span>;
}
