import type { ResolvedTheme } from "./types";
import { resolveTheme } from "./data";
import { neutral } from "./neutral";
import { deepClone, deepFreeze } from "./util";

/**
 * Design system de ejemplo "neón": oscuro, píldoras de vidrio con halo, números con degradado que se mueve, fondo de puntos,
 * movimiento enérgico (escala con rebote, cámara inclinada) y pasos de una escena a otra sin velo. Inventado y genérico.
 */
export const neon: ResolvedTheme = deepFreeze(resolveTheme({
  ...deepClone(neutral),
  name: "neon",
  color: {
    bg: "#090b16",
    surface: "#131830",
    surfaceAlt: "#1b2142",
    text: "#f2f4ff",
    textMuted: "#b4bbe0",
    border: "#323a72",
    accent: "#3de0ff",
    accent2: "#ff5fd2",
    onAccent: "#06101a",
    success: "#52f0a5",
    warning: "#ffd04d",
    danger: "#ff7a93",
    chart: ["#3de0ff", "#ff5fd2", "#ffd04d", "#52f0a5", "#9d8cff", "#ff9a5c"],
  },
  gradient: { brand: "linear-gradient(90deg, #3de0ff 0%, #ff5fd2 100%)" },
  font: {
    family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    weights: { regular: 400, medium: 500, semibold: 700, stat: 800 },
  },
  radius: { sm: 8, md: 14, panel: 20, lg: 28, pill: 999 },
  shadow: {
    sm: "0 0 0 1px rgba(61,224,255,.16), 0 2px 8px rgba(0,0,0,.5)",
    md: "0 0 0 1px rgba(61,224,255,.2), 0 6px 20px rgba(0,0,0,.55)",
    lg: "0 0 0 1px rgba(61,224,255,.24), 0 14px 40px rgba(0,0,0,.65)",
  },
  motion: {
    easing: { standard: [0.2, 0.9, 0.2, 1], out: [0.1, 0.8, 0.2, 1], inOut: [0.7, 0, 0.2, 1] },
    duration: { fast: 6, base: 12, slow: 24 },
  },
  cloud: { colors: ["#1b6a85", "#8a2a77", "#3a3fa0"], opacity: 0.3 },
  style: {
    shape: { corners: "pill", border: 1, outlined: true },
    surface: { kind: "glass", elevation: "glow", opacity: 0.72 },
    type: { titleWeight: "stat", labelWeight: "medium", titleTracking: -0.03, eyebrowCase: "upper", eyebrowTracking: 0.16, numerals: "gradient", highlight: "gradient" },
    background: { kind: "dots", intensity: 0.7 },
    motion: { entrance: "scale", overshoot: 0.12, stagger: 2, cameraBlur: true, cameraTilt: 1.6, transition: "through" },
    decor: { doodles: true, doodleStroke: "geometric", vignette: 0.6, accent: "bar", gradientLoop: 90 },
    story: {
      titleCard: "glass", listLayout: "stacked", listUnderline: "name", handoff: "through", headlineSize: "md", closingBg: "bg", signoffBar: true,
      wallColumns: 8, wallRows: 7, wallChipScale: 0.85, wallDolly: 300, wallDepth: 1.5, wallBlurOpening: true, wallBlurClosing: true,
    },
    chart: { barRadius: "lg", lineWidth: 6, grid: "off", fill: "gradient" },
  },
}));
