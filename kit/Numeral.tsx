import React from "react";
import { isValidColor, numeralStyle, useTheme } from "../themes";
import { useFrameOr } from "./util";

/**
 * Número de paso o de lista (`01`, `02`...) con el tratamiento de `style.type.numerals`: `gradient` (el degradado de marca, con el
 * vaivén de `decor.gradientLoop`), `solid` (el primer acento que llega a 4,5:1 sobre `on`), `outline` o `muted`. No es para métricas
 * (`CountUp`, `DigitRoll`...: son cifras de contenido). `on` es el fondo sobre el que va (por defecto `color.surface`; una cadena
 * que no sea un color, como `transparent`, se ignora); `loop` pisa el vaivén del tema.
 */
export function Numeral({ children, frame, loop, on, style }: { children?: React.ReactNode; frame?: number; loop?: number; on?: string; style?: React.CSSProperties }) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  return <span style={{ ...numeralStyle(theme, { frame: f, loop, on: on && isValidColor(on) ? on : undefined }), ...style }}>{children}</span>;
}
