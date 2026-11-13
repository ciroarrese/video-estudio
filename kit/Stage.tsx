import React from "react";
import { backgroundLayer, useTheme } from "../themes";
import { CloudBackground } from "./CloudBackground";
import type { CloudOptions } from "./CloudBackground";
import { firstFamily, fontFaceCss } from "./fonts";
import { useThemeFonts } from "./ThemeScope";

export { firstFamily };

/**
 * Escena a cuadro completo: fondo, tipografía y color de texto del tema, con la capa de fondo del estilo (`style.background`:
 * nubes, liso, grilla, puntos, degradado o grano fijo). Las nubes solo se dibujan si `clouds` (por defecto sí) y el estilo
 * pide nubes, o si la escena pasa `cloud` a propósito.
 */
export function Stage({
  clouds = true,
  cloudOpacity,
  cloud,
  frame,
  children,
}: {
  clouds?: boolean;
  cloudOpacity?: number;
  /** Colores, cantidad, semilla, manchas explícitas y opacidad de las nubes de esta escena; lo que falte sale de `theme.cloud`. */
  cloud?: CloudOptions;
  frame?: number;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  useThemeFonts(theme);
  const fontCss = fontFaceCss(theme);
  const layer = backgroundLayer(theme);
  const showClouds = clouds && (layer.clouds || cloud !== undefined);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: theme.color.bg,
        color: theme.color.text,
        fontFamily: theme.font.family,
        fontWeight: theme.font.weights.regular,
      }}
    >
      {fontCss && <style>{fontCss}</style>}
      {layer.style && <div data-qa-ignore="covered" style={{ position: "absolute", inset: 0, pointerEvents: "none", ...layer.style }} />}
      {showClouds && <CloudBackground frame={frame} {...cloud} opacity={cloudOpacity ?? cloud?.opacity ?? layer.cloudOpacity} />}
      {children}
    </div>
  );
}
