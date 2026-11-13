import type { ResolvedTheme } from "./types";
import { resolveTheme } from "./data";
import { neutral } from "./neutral";
import { deepClone, deepFreeze } from "./util";

/**
 * Design system de ejemplo "editorial": papel claro, esquinas rectas, superficies de contorno y planas, tipografía con serif genérico,
 * subrayados como énfasis, fondo de grilla, movimiento sobrio (fundido y barrido) y cortinas entre escenas. Inventado y genérico: sin marca ni fuentes propias.
 */
export const editorial: ResolvedTheme = deepFreeze(resolveTheme({
  ...deepClone(neutral),
  name: "editorial",
  color: {
    bg: "#f3efe6",
    surface: "#fbf9f3",
    surfaceAlt: "#e8e2d4",
    text: "#1d1b17",
    textMuted: "#57524a",
    border: "#c9c1ae",
    accent: "#8f1d2c",
    accent2: "#1d5a66",
    onAccent: "#fbf9f3",
    success: "#1b6b3b",
    warning: "#805000",
    danger: "#a31621",
    chart: ["#8f1d2c", "#1d5a66", "#7a5c00", "#4b5d2a", "#6b3a7a", "#b3541e"],
  },
  gradient: { brand: "linear-gradient(90deg, #8f1d2c 0%, #1d5a66 100%)" },
  font: {
    family: 'ui-serif, Georgia, "Times New Roman", serif',
    weights: { regular: 400, medium: 500, semibold: 600, stat: 700 },
  },
  radius: { sm: 2, md: 3, panel: 4, lg: 6, pill: 999 },
  shadow: {
    sm: "0 1px 0 rgba(29,27,23,.10)",
    md: "0 2px 0 rgba(29,27,23,.12)",
    lg: "0 4px 0 rgba(29,27,23,.14)",
  },
  motion: {
    easing: { standard: [0.4, 0, 0.2, 1], out: [0.2, 0, 0, 1], inOut: [0.6, 0, 0.4, 1] },
    duration: { fast: 10, base: 20, slow: 36 },
  },
  cloud: { colors: ["#8f1d2c", "#1d5a66", "#7a5c00"], opacity: 0.08 },
  style: {
    shape: { corners: "sharp", border: 1, outlined: true },
    surface: { kind: "outline", elevation: "flat", opacity: 0.9 },
    type: { titleWeight: "medium", labelWeight: "regular", titleTracking: -0.01, eyebrowCase: "upper", eyebrowTracking: 0.14, numerals: "solid", highlight: "underline" },
    background: { kind: "grid", intensity: 0.45 },
    motion: { entrance: "fade", overshoot: 0, stagger: 3, cameraBlur: true, cameraTilt: 0.4, transition: "wipe" },
    decor: { doodles: false, doodleStroke: "geometric", vignette: 0, accent: "underline", gradientLoop: 0 },
    story: {
      titleCard: "solid", listLayout: "inline", listUnderline: "name", handoff: "dock", headlineSize: "sm", closingBg: "surface", signoffBar: false,
      wallColumns: 5, wallRows: 6, wallChipScale: 0.9, wallDolly: 0, wallDepth: 0.5, wallBlurOpening: true, wallBlurClosing: false,
    },
    line: { weight: "hairline", dash: "solid", cap: "square", glow: 0, dotShape: "square", accentUse: "sparse", sketch: 0 },
    solid: { fill: "outline", contrast: 1, edge: "gap" },
    depth: { extrude: "outline-stack", fog: false },
    text: { arrival: "fade", caret: "underscore", tile: "outline", charset: "caps", decoration: "underline" },
    chart: { barRadius: "none", lineWidth: 3, grid: "on", fill: "hatched" },
  },
}));
