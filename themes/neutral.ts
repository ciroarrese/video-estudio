import type { Theme } from "./types";
import { deepFreeze } from "./util";

export const neutral: Theme = deepFreeze<Theme>({
  name: "neutral",
  color: {
    bg: "#f6f7fb",
    surface: "#ffffff",
    surfaceAlt: "#eceff6",
    text: "#171a2b",
    textMuted: "#51566b",
    border: "#d9dce8",
    accent: "#3b5bdb",
    accent2: "#7048e8",
    onAccent: "#ffffff",
    success: "#176b3e",
    warning: "#945800",
    danger: "#c92a2a",
    chart: ["#3b5bdb", "#7048e8", "#0c8599", "#e8590c", "#2f9e44", "#d6336c"],
  },
  gradient: { brand: "linear-gradient(90deg, #3b5bdb 0%, #7048e8 100%)" },
  font: {
    family:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    weights: { regular: 400, medium: 500, semibold: 600, stat: 700 },
  },
  radius: { sm: 6, md: 10, panel: 14, lg: 20, pill: 999 },
  shadow: {
    sm: "0 1px 2px rgba(23,26,43,.06)",
    md: "0 4px 12px rgba(23,26,43,.10)",
    lg: "0 12px 32px rgba(23,26,43,.14)",
  },
  type: { hero: 120, h1: 96, h2: 72, body: 44, caption: 32, eyebrow: 26, stat: 180 },
  safe: { x: 140, y: 110 },
  motion: {
    easing: {
      standard: [0.4, 0, 0.2, 1],
      out: [0, 0, 0.2, 1],
      inOut: [0.65, 0, 0.35, 1],
    },
    duration: { fast: 8, base: 16, slow: 30 },
  },
  cloud: { colors: ["#3b5bdb", "#7048e8", "#0c8599"], opacity: 0.18 },
});
