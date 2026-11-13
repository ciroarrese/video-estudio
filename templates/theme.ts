// Plantilla del tema de un video. En la etapa 2 del skill se reemplaza por el tema armado
// desde los tokens de la persona (ver videos/<slug>/theme.ts y themes/README.md).
//
// Con tokens (paleta, tipografías, radios, sombras) y el estilo elegido:
//
//   import { themeFromTokensWithReport, checkTheme } from "../../themes";
//   const { theme: t, report } = themeFromTokensWithReport(tokens, neutral, { style: ESTILO });
//   // report.style.mapped / fallback / invalid dicen qué campos salieron de dónde; checkTheme(t) revisa contraste y estilo.
//
// El estilo también puede venir como tokens `--style-<grupo>-<campo>` (por ejemplo `--style-shape-corners: sharp`).
// Una escena nunca decide esto: usa las ayudas (`surfaceStyle`, `cornerRadius`, `textStyle`, `entrance`...) y el tema lo resuelve.
// Referencias completas: los tres design systems de ejemplo (`themes/editorial.ts`, `themes/neon.ts`, `themes/papel.ts`) y `docs/estilo.md`.
import { neutral } from "../themes";
import type { Theme, ThemeStyleInput } from "../themes";

/**
 * Estilo del design system. Los valores de abajo son los POR DEFECTO (con ellos el video se ve igual que con `neutral`):
 * cambiá solo lo que el design system decide distinto y borrá el resto. Un valor inválido lanza un error que lista los aceptados.
 */
const ESTILO: ThemeStyleInput = {
  // Forma: `pill` (chips y píldoras redondos), `rounded` (esquinas suaves), `sharp` (sin radio). `border` en px; `outlined: false` quita bordes.
  shape: { corners: "pill", border: 1, outlined: true },
  // Superficie: `solid` | `glass` | `outline` | `tinted`; elevación: `shadow` | `flat` | `border` (filo duro) | `glow` (halo de acento).
  surface: { kind: "solid", elevation: "shadow", opacity: 0.74 },
  // Texto: pesos (`regular` | `medium` | `semibold` | `stat`), interletrado, mayúsculas de los rótulos, y cómo se ven los números y la palabra resaltada.
  type: { titleWeight: "semibold", labelWeight: "medium", titleTracking: 0, eyebrowCase: "as-is", eyebrowTracking: 0, numerals: "gradient", highlight: "gradient" },
  // Fondo: `clouds` | `plain` | `grid` | `dots` | `gradient` | `noise`, con su intensidad de 0 a 1.
  background: { kind: "clouds", intensity: 1 },
  // Movimiento: cómo entran las cosas (`auto` deja la de cada pieza), rebote, paso entre elementos (cuadros), desenfoque y transición entre escenas.
  motion: { entrance: "auto", overshoot: 0, stagger: 4, cameraBlur: true, cameraTilt: 1, transition: "wash" },
  // Decoración: garabatos y su trazo (`hand` | `geometric`), viñeta (0 la apaga), marca de acento (`bar` | `underline` | `dot` | `none`).
  decor: { doodles: true, doodleStroke: "hand", vignette: 1, accent: "bar", gradientLoop: 0 },
  // Gráficos: radio de las barras, grosor de línea, guías (`auto` | `on` | `off`) y relleno (`solid` | `gradient` | `hatched`).
  chart: { barRadius: "md", lineWidth: 5, grid: "auto", fill: "solid" },
  // Opcionales, para los efectos de `fx/`: `line` (grosor, guías, halo), `solid` (relleno y aristas de los sólidos), `depth` (volumen),
  // `text` (llegada, cursor, losetas, adornos) y `story` (valores por defecto de `spec.design` de las historias). Ver docs/estilo.md.
  //   line: { weight: "regular", dash: "solid", glow: 0 },
  //   story: { titleCard: "solid", listLayout: "stacked", handoff: "wash" },
};

export const theme: Theme = { ...neutral, style: ESTILO };
