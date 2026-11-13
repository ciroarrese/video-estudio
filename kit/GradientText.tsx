import React from "react";
import { useTheme } from "../themes";
import { useFrameOr } from "./util";

/** Texto con el degradado de marca del tema; con `pan` (velocidad; 1 = un vaivén cada ~125 cuadros) el degradado oscila sin saltos. */
export function GradientText({
  children,
  frame,
  pan = 0,
  style,
}: {
  children?: React.ReactNode;
  frame?: number;
  pan?: number;
  style?: React.CSSProperties;
}) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const pos = pan ? `${50 + 50 * Math.sin(f * pan * 0.05)}% 0` : "0% 0";
  return (
    <span
      style={{
        background: theme.gradient.brand,
        backgroundSize: pan ? "200% 100%" : "100% 100%",
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
