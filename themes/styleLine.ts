import type { Theme } from "./types";
import { resolveStyle } from "./style";
import type { AccentUse, CaretStyle, DotShape, ExtrudeStyle, LineDash, SolidEdge, SolidFill, TextArrival, TextDecoration, TileStyle } from "./styleTypes";

/*
 * Ayudas puras para las piezas de línea, sólidos, profundidad y texto de `fx/` (`style.line`, `style.solid`, `style.depth`, `style.text`).
 * Como el resto de `themes/`: sin estado ni azar; una pieza no compara cadenas del estilo, llama a estas ayudas (las de `fx/three` las
 * envuelven en `penFor`, en `fx/three/common.ts`, y las de `fx/text` en `fx/text/look.tsx`).
 */

export interface LineLook {
  /** Multiplicador del grosor de los trazos (hairline 0,5, regular 1, bold 1,8). */
  widthK: number;
  /** Multiplicador del radio de los puntos (0,8, 1, 1,25). */
  dotK: number;
  dash: LineDash;
  /** `true`: corte recto y esquinas vivas (`butt` + `miter`). */
  square: boolean;
  glow: number;
  dotShape: DotShape;
  accentUse: AccentUse;
  sketch: number;
}

const WEIGHT_K = { regular: 1, hairline: 0.5, bold: 1.8 } as const;
const DOT_K = { regular: 1, hairline: 0.8, bold: 1.25 } as const;

/** Lectura de `style.line`. Con el estilo por defecto: `widthK` 1, `dotK` 1, líneas llenas, cap redondo, sin halo ni temblor. */
export function lineLook(theme: Theme): LineLook {
  const l = resolveStyle(theme).line;
  return { widthK: WEIGHT_K[l.weight], dotK: DOT_K[l.weight], dash: l.dash, square: l.cap === "square", glow: l.glow, dotShape: l.dotShape, accentUse: l.accentUse, sketch: l.sketch };
}

export interface SolidLook {
  fill: SolidFill;
  contrast: number;
  edge: SolidEdge;
}

/** Lectura de `style.solid`. */
export function solidLook(theme: Theme): SolidLook {
  const s = resolveStyle(theme).solid;
  return { fill: s.fill, contrast: s.contrast, edge: s.edge };
}

export interface DepthLook {
  extrude: ExtrudeStyle;
  fog: boolean;
}

/** Lectura de `style.depth`. */
export function depthLook(theme: Theme): DepthLook {
  const d = resolveStyle(theme).depth;
  return { extrude: d.extrude, fog: d.fog };
}

/** Alfabetos de glifos de `style.text.charset`; `caps` es `undefined` (cada efecto trae el suyo). */
const CHARSETS: Record<string, string | undefined> = {
  caps: undefined,
  hex: "0123456789ABCDEF",
  binary: "01",
  symbols: "#%&*+=?/<>[]{}~^$@",
};

export interface TextLook {
  arrival: TextArrival;
  caret: CaretStyle;
  tile: TileStyle;
  /** Alfabeto elegido por el tema; `undefined` = el propio del efecto. */
  glyphs: string | undefined;
  decoration: TextDecoration;
}

/** Lectura de `style.text`. Con el estilo por defecto: `rise`, `bar`, `card`, alfabeto propio y sin adorno. */
export function textLook(theme: Theme): TextLook {
  const t = resolveStyle(theme).text;
  return { arrival: t.arrival, caret: t.caret, tile: t.tile, glyphs: CHARSETS[t.charset], decoration: t.decoration };
}

/**
 * Temblor de trazo a mano: desplazamiento (px) de un punto de pantalla, función fija de su posición (suma de senos de fases fijas):
 * dos puntos iguales dan el mismo desplazamiento (los vértices compartidos de un sólido no se separan) y un trazo largo, subdividido,
 * se ondula. No usa azar ni el cuadro. `amp` en px.
 */
export function sketchOffset(x: number, y: number, amp: number): { dx: number; dy: number } {
  const dx = Math.sin(x * 0.043 + 1.3) * 0.6 + Math.sin(y * 0.071 + x * 0.017 + 4.1) * 0.4;
  const dy = Math.sin(y * 0.047 + 2.2) * 0.6 + Math.sin(x * 0.063 + y * 0.021 + 0.7) * 0.4;
  return { dx: dx * amp, dy: dy * amp };
}
