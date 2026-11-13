import React, { createContext, useContext } from "react";
import type { Theme } from "./types";
import { neutral } from "./neutral";
import { parseColor } from "./color";

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ theme, children }: { theme: Theme; children?: React.ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** Devuelve el tema activo, o el neutro si no hay proveedor. */
export function useTheme(): Theme {
  return useContext(ThemeContext) ?? neutral;
}

/** Aplica opacidad (0..1) a un color hex, rgb(a) o hsl(a); devuelve rgba(). */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  if (!c) return color;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${+a.toFixed(4)})`;
}
