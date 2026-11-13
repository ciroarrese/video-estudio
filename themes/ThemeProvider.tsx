import React, { createContext, useContext } from "react";
import type { ResolvedTheme, Theme } from "./types";
import { neutral } from "./neutral";
import { parseColor } from "./color";
import { resolveTheme } from "./data";

const ThemeContext = createContext<ResolvedTheme | null>(null);

export function ThemeProvider({ theme, children }: { theme: Theme; children?: React.ReactNode }) {
  return <ThemeContext.Provider value={resolveTheme(theme)}>{children}</ThemeContext.Provider>;
}

/**
 * Devuelve el tema activo, o el neutro si no hay proveedor.
 * `type.ui` y `data` siempre están: `data.<nombre>` lanza un error claro si ese color de datos no está declarado.
 */
export function useTheme(): ResolvedTheme {
  return useContext(ThemeContext) ?? neutral;
}

/** Aplica opacidad (0..1) a un color hex, rgb(a) o hsl(a); devuelve rgba(). */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  if (!c) return color;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${+a.toFixed(4)})`;
}
