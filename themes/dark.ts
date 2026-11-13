import type { Theme } from "./types";
import { neutral } from "./neutral";
import { deepClone, deepFreeze } from "./util";

export const dark: Theme = deepFreeze<Theme>({
  ...deepClone(neutral),
  name: "dark",
  color: {
    bg: "#0e1020",
    surface: "#171a2e",
    surfaceAlt: "#20243d",
    text: "#f1f3fb",
    textMuted: "#a9aec6",
    border: "#2e3352",
    accent: "#7c96ff",
    accent2: "#a98bff",
    onAccent: "#0e1020",
    success: "#4cd08a",
    warning: "#f2b84b",
    danger: "#ff7b7b",
    chart: ["#7c96ff", "#a98bff", "#3cc6d9", "#ff9a5c", "#5bd07a", "#f472a8"],
  },
  gradient: { brand: "linear-gradient(90deg, #7c96ff 0%, #a98bff 100%)" },
  shadow: {
    sm: "0 1px 2px rgba(0,0,0,.4)",
    md: "0 4px 12px rgba(0,0,0,.5)",
    lg: "0 12px 32px rgba(0,0,0,.6)",
  },
  cloud: { colors: ["#4c63d9", "#7a55e0", "#1d8ea0"], opacity: 0.28 },
});
