import React from "react";
import { useTheme } from "../themes";
import { CloudBackground } from "./CloudBackground";

/** Primer nombre de familia de una pila CSS, sin comillas: es el nombre que se usa en `@font-face`. */
export function firstFamily(stack: string): string {
  const m = /^\s*(?:"([^"]+)"|'([^']+)'|([^,]+))/.exec(stack);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? stack).trim();
}

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
  const face = firstFamily(theme.font.family);
  const fontCss = (theme.font.files ?? [])
    .map((f) => `@font-face{font-family:${JSON.stringify(face)};font-weight:${f.weight};src:url(${JSON.stringify(f.src)});}`)
    .join("");
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
