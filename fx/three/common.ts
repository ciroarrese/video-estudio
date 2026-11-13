// Ayudas compartidas por las piezas 3D: paleta del tema, tiempo local y primitivas de dibujo en canvas.
import { clamp, fxBox, mix, progress, roleColor, useFx } from "../core";
import type { ColorRole, FxProps } from "../core";
import { parseColor } from "../../themes";
import type { Theme } from "../../themes";
import { sortBackToFront } from "./math";

/** Props comunes de las piezas 3D: las de `FxProps` y sobrescrituras de color por rol del tema. */
export type ThreeProps = FxProps & {
  /** Rol del fondo (relleno que tapa lo de atras). Por defecto `bg`. */
  bg?: ColorRole;
  /** Rol de la tinta (trazos principales y texto). Por defecto `text`. */
  ink?: ColorRole;
  /** Rol de las lineas finas. Por defecto `textMuted`. */
  line?: ColorRole;
  /** Rol del acento. Por defecto `accent`. */
  accent?: ColorRole;
};

export interface Palette {
  bg: string;
  ink: string;
  line: string;
  accent: string;
  accent2: string;
  surface: string;
  /** El mas oscuro y el mas claro entre fondo y tinta: extremos para sombrear sin importar el tema. */
  darkest: string;
  lightest: string;
}

export function luminance(color: string): number {
  const c = parseColor(color);
  if (!c) return 0.5;
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

export function palette(theme: Theme, p: Pick<ThreeProps, "bg" | "ink" | "line" | "accent"> = {}): Palette {
  const bg = roleColor(theme, p.bg ?? "bg");
  const ink = roleColor(theme, p.ink ?? "text");
  const darkFirst = luminance(bg) < luminance(ink);
  return {
    bg,
    ink,
    line: roleColor(theme, p.line ?? "textMuted"),
    accent: roleColor(theme, p.accent ?? "accent"),
    accent2: theme.color.accent2,
    surface: theme.color.surface,
    darkest: darkFirst ? bg : ink,
    lightest: darkFirst ? ink : bg,
  };
}

/** Color de una cara con intensidad `s` (0..1): hacia lo oscuro con poca luz, un toque de claro con mucha. */
export function shadeColor(base: string, s: number, pal: Palette): string {
  const k = clamp(s);
  return mix(mix(base, pal.darkest, 0.55), mix(base, pal.lightest, 0.18), k);
}

export interface ThreeFx {
  /** Cuadro absoluto. */
  frame: number;
  /** Cuadro local acotado a [0, duration]: la animacion queda quieta al terminar (still compuesto). */
  local: number;
  /** Progreso lineal 0..1 de toda la animacion. */
  t: number;
  width: number;
  height: number;
  duration: number;
  theme: Theme;
  pal: Palette;
}

/** Resuelve cuadro, caja, duracion, tema y paleta de una pieza 3D. */
export function useThreeFx(p: ThreeProps, def: { width: number; height: number; duration: number }): ThreeFx {
  const { frame, local, theme } = useFx(p);
  const { width, height } = fxBox(p, def);
  const duration = p.duration ?? def.duration;
  return {
    frame,
    local: clamp(local, 0, duration),
    t: progress(local, 0, duration),
    width,
    height,
    duration,
    theme,
    pal: palette(theme, p),
  };
}

type Ctx = CanvasRenderingContext2D;

export function seg(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, alpha: number, width: number): void {
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function dot(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1): void {
  if (r <= 0) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Polígono: el relleno es siempre opaco (tapa lo de atrás); `strokeAlpha` solo afecta al trazo. */
export function poly(ctx: Ctx, pts: { x: number; y: number }[], fill: string | null, stroke: string | null, lineWidth = 1, strokeAlpha = 1): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) {
    ctx.globalAlpha = clamp(strokeAlpha);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Primitiva con profundidad: se junta y se dibuja de atras hacia adelante. */
export interface Prim { depth: number; draw: (ctx: Ctx) => void }

export function flush(ctx: Ctx, prims: Prim[]): void {
  for (const p of sortBackToFront(prims, (q) => q.depth)) p.draw(ctx);
}

/** Dibuja una polilinea 3D ya proyectada segmento a segmento, con opacidad y grosor por profundidad. */
export function depthPolyline(
  ctx: Ctx,
  pts: { x: number; y: number; depth: number }[],
  color: string,
  style: (depth: number) => { alpha: number; width: number },
  closed = false,
): void {
  const n = pts.length;
  const last = closed ? n : n - 1;
  ctx.lineCap = "round";
  for (let i = 0; i < last; i++) {
    const a = pts[i]!, b = pts[(i + 1) % n]!;
    const st = style((a.depth + b.depth) / 2);
    seg(ctx, a.x, a.y, b.x, b.y, color, st.alpha, st.width);
  }
}

/** Mide la fracción 0..1 de `i` dentro de `n` con un tramo de `span` (0..1) de retraso escalonado. */
export function staggerT(t: number, i: number, n: number, span = 0.4): number {
  const d = n <= 1 ? 0 : (i / (n - 1)) * span;
  return clamp((t - d) / (1 - span));
}

/** Contorno de un rectángulo con esquinas redondeadas en el plano (x, y), antihorario, sin repetir el primer punto. */
export function roundedRect(x0: number, y0: number, x1: number, y1: number, r: number, seg = 5): { x: number; y: number }[] {
  const rr = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  const out: { x: number; y: number }[] = [];
  // Antihorario con y hacia arriba: derecha-abajo, derecha-arriba, izquierda-arriba, izquierda-abajo.
  const cs: [number, number, number][] = [
    [x1 - rr, y0 + rr, -Math.PI / 2],
    [x1 - rr, y1 - rr, 0],
    [x0 + rr, y1 - rr, Math.PI / 2],
    [x0 + rr, y0 + rr, Math.PI],
  ];
  for (const [cx, cy, a0] of cs) {
    for (let k = 0; k <= seg; k++) {
      const a = a0 + (k / seg) * (Math.PI / 2);
      out.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
  }
  return out;
}
