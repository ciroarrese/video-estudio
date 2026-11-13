import React from "react";
import { useTheme } from "../themes";
import { CloudBackground } from "./CloudBackground";
import { firstFamily, fontFaceCss } from "./fonts";
import { useThemeFonts } from "./ThemeScope";

export { firstFamily };

/** Escena a cuadro completo: fondo, tipografía y color de texto del tema, con nubes opcionales. */
export function Stage({
  clouds = true,
  cloudOpacity,
  frame,
  children,
}: {
  clouds?: boolean;
  cloudOpacity?: number;
  frame?: number;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  useThemeFonts(theme);
  const fontCss = fontFaceCss(theme);
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
      {clouds && <CloudBackground frame={frame} opacity={cloudOpacity} />}
      {children}
    </div>
  );
}
