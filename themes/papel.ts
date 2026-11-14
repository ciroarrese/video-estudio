import type { ResolvedTheme } from "./types";
import { resolveTheme } from "./data";
import { neutral } from "./neutral";
import { deepClone, deepFreeze } from "./util";

/**
 * Design system de ejemplo "papel": cálido, esquinas redondeadas, tarjetas teñidas con sombra suave, garabatos a mano, resalte con
 * marcador, fondo con grano fijo y movimiento que sube con un rebote leve. Inventado y genérico.
 */
export const papel: ResolvedTheme = deepFreeze(resolveTheme({
  ...deepClone(neutral),
  name: "papel",
  color: {
    bg: "#f6eddc",
    surface: "#fffaf0",
    surfaceAlt: "#ecdfc7",
    text: "#35261c",
    textMuted: "#6a5444",
    border: "#d6c4a5",
    accent: "#b3400f",
    accent2: "#2a6b5a",
    onAccent: "#fffaf0",
    success: "#25663a",
    warning: "#7a4a00",
    danger: "#a8231f",
    chart: ["#b3400f", "#2a6b5a", "#a1710a", "#5a5ea8", "#a63d6d", "#3d7a2e"],
  },
  gradient: { brand: "linear-gradient(90deg, #b3400f 0%, #2a6b5a 100%)" },
  font: {
    family: 'ui-rounded, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    weights: { regular: 400, medium: 500, semibold: 600, stat: 700 },
  },
  radius: { sm: 10, md: 16, panel: 20, lg: 26, pill: 999 },
  shadow: {
    sm: "0 1px 0 rgba(53,38,28,.08), 0 2px 4px rgba(53,38,28,.08)",
    md: "0 2px 0 rgba(53,38,28,.08), 0 6px 14px rgba(53,38,28,.12)",
    lg: "0 3px 0 rgba(53,38,28,.08), 0 14px 30px rgba(53,38,28,.16)",
  },
  motion: {
    easing: { standard: [0.3, 0, 0.2, 1], out: [0.1, 0.7, 0.2, 1], inOut: [0.6, 0, 0.35, 1] },
    duration: { fast: 9, base: 18, slow: 32 },
  },
  cloud: { colors: ["#e0a46a", "#7fb59f", "#d9c28a"], opacity: 0.22 },
  style: {
    shape: { corners: "rounded", border: 2, outlined: true, heroScale: 1.25 },
    surface: { kind: "tinted", elevation: "shadow", opacity: 0.9 },
    type: { titleWeight: "stat", labelWeight: "semibold", titleTracking: 0, eyebrowCase: "as-is", eyebrowTracking: 0.04, numerals: "solid", highlight: "marker" },
    background: { kind: "noise", intensity: 1 },
    motion: { entrance: "rise", overshoot: 0.06, stagger: 4, staggerChips: 0.7, cameraBlur: true, cameraTilt: 1, transition: "wash" },
    decor: { doodles: true, doodleStroke: "hand", vignette: 0.4, accent: "dot", accentThickness: 1.5, gradientLoop: 0 },
    story: {
      titleCard: "solid", listLayout: "stacked", listUnderline: "row", handoff: "wash", headlineSize: "md", closingBg: "surface", signoffBar: true,
      wallColumns: null, wallRows: null, wallChipScale: 1.1, wallDolly: 0, wallDepth: 1, wallGapX: 1.05, wallGapY: 1, wallBrick: 1, wallJitter: 1.6, wallBlurOpening: true, wallBlurClosing: true,
    },
    line: { weight: "regular", dash: "dashed", cap: "round", glow: 0, dotShape: "cross", accentUse: "balanced", sketch: 0.7 },
    solid: { fill: "flat", contrast: 1, edge: "ink" },
    depth: { extrude: "long-shadow", fog: true },
    text: { arrival: "rise", caret: "bar", tile: "flat", charset: "symbols", decoration: "marker" },
    chart: { barRadius: "sm", lineWidth: 4, grid: "on", fill: "solid" },
  },
}));
