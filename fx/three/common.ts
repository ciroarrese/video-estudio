// Ayudas compartidas por las piezas 3D: paleta del tema, tiempo local y primitivas de dibujo en canvas.
import { clamp, fxBox, lerp, mix, progress, roleColor, useFx } from "../core";
import type { ColorRole, FxProps } from "../core";
import { borderWidth, depthLook, lineLook, parseColor, sketchOffset, solidLook, staggerFrames, surfaceStyle } from "../../themes";
import type { Theme } from "../../themes";
import type React from "react";
import { lineByDepth, sortBackToFront } from "./math";
import type { LineStyleOptions } from "./math";

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
  /** Escala de trazos y puntos: crece con la caja (1,8 en una de 900 px) para que las líneas aguanten en video. */
  k: number;
  /** Pluma del design system: trazos, puntos y caras según `style.line`, `style.solid` y `style.depth` (ver `penFor`). */
  pen: Pen;
}

/** Escala de trazos para una caja: 1,8 a 900 px de lado menor, proporcional al resto. */
export function strokeScale(width: number, height: number): number {
  return (Math.min(width, height) / 900) * 1.8;
}

/** Resuelve cuadro, caja, duracion, tema y paleta de una pieza 3D. */
export function useThreeFx(p: ThreeProps, def: { width: number; height: number; duration: number }): ThreeFx {
  const { frame, local, theme } = useFx(p);
  const { width, height } = fxBox(p, def);
  const duration = p.duration ?? def.duration;
  const pal = palette(theme, p);
  const k = strokeScale(width, height);
  return {
    frame,
    local: clamp(local, 0, duration),
    t: progress(local, 0, duration),
    width,
    height,
    duration,
    theme,
    pal,
    k,
    pen: penFor(theme, pal, k),
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

/**
 * Superficie de una tarjeta plana (`CardFlip`, `CarouselRing`) según `style.shape` y `style.surface`: radio, relleno, borde grueso (`bold`) y sombra de
 * `surfaceStyle(theme, "card")`. Con el estilo por defecto reproduce lo de siempre: borde de 2 px (`borderWidth(theme, "card", { bold: true })`) y SIN sombra (la
 * elevación `shadow` no se dibuja: estas tarjetas ya se sombrean al girar); `flat` la deja así, `border` y `glow` sí agregan su filo o halo.
 * - `alt`: cara apagada (reverso, tarjetas del fondo): `surfaceAlt` si el relleno es el sólido del tema; vidrio, contorno y teñido se respetan.
 * - `accent`: color de acento (CSS) para el borde en vez del de la superficie (cara que mira al frente); sin borde en el estilo no lo agrega.
 * - `guide`: tarjeta de fondo (construcción): el borde toma el carácter de `style.line.dash` (discontinuo o punteado).
 * El grosor del borde sigue a `style.line.weight` y, con `style.line.glow`, el borde de acento suma un halo.
 */
export function cardSurface(theme: Theme, o: { alt?: boolean; accent?: string; guide?: boolean } = {}): React.CSSProperties {
  const s = surfaceStyle(theme, "card", { bold: true });
  const out: React.CSSProperties = {};
  out.background = o.alt && s.background === theme.color.surface ? theme.color.surfaceAlt : s.background;
  const w = borderWidth(theme, "card", { bold: true });
  if (w > 0 && s.border) {
    const L = lineLook(theme);
    const bw = L.widthK === 1 ? w : Math.max(1, Math.round(w * L.widthK * 2) / 2);
    const kind = o.guide && L.dash !== "solid" ? L.dash : "solid";
    out.border = o.accent ? `${bw}px ${kind} ${o.accent}` : String(s.border).replace(/^[\d.]+px/, `${bw}px`).replace(" solid ", ` ${kind} `);
  }
  out.borderRadius = s.borderRadius;
  if (s.boxShadow && s.boxShadow !== theme.shadow.md) out.boxShadow = s.boxShadow;
  else if (o.accent && lineLook(theme).glow > 0) out.boxShadow = `0 0 ${Math.round(28 * lineLook(theme).glow)}px ${mix(o.accent, theme.color.bg, 0.5)}`;
  return out;
}

/**
 * Demora (cuadros) del elemento `i` de `n` con el paso propio `base` escalado por `motion.stagger` (4 = sin cambio). Con `room` (cuadros
 * disponibles desde el primero hasta el último), el paso no crece más de lo que deja terminar a tiempo (nunca baja del propio): el último cuadro sigue siendo imagen fija.
 */
export function stepDelay(theme: Theme, i: number, n: number, base: number, room: number): number {
  const step = staggerFrames(theme, 1, { base });
  return i * (n > 1 ? Math.min(step, Math.max(base, room / (n - 1))) : step);
}

// ---------- pluma del design system ----------

export interface SegOptions {
  /** Línea principal: siempre llena, aunque `style.line.dash` pida guías discontinuas. Por defecto es guía. */
  main?: boolean;
  /** Índice del tramo dentro de una polilínea de tramos cortos: con guías discontinuas, el patrón se corta por tramo y no por píxel. */
  i?: number;
}

type Pt = { x: number; y: number };

/**
 * Pluma de una pieza 3D: trazos, puntos, caras y profundidad según `style.line`, `style.solid` y `style.depth` (ver `docs/estilo.md`).
 * Con el estilo por defecto cada llamada hace exactamente las mismas operaciones de canvas que `seg`, `dot` y `poly`. Todo es función pura
 * de los argumentos: el halo es una segunda pasada ancha y tenue (no `shadowBlur`) y el temblor de mano una función fija de la posición.
 */
export interface Pen {
  /** Multiplicador del grosor (`style.line.weight`). */
  w: number;
  /** `false`: sin atenuación ni afinado por distancia (`style.depth.fog`). */
  fog: boolean;
  /** Extrusión elegida (`style.depth.extrude`): la leen `ExtrudeType`, `IsoCity` y `LayerExplode`. */
  extrude: "stack" | "long-shadow" | "outline-stack" | "none";
  /** `true` con `accentUse: "sparse"`: el acento solo en lo principal. */
  sparse: boolean;
  /** Corrimiento de umbrales de acento por `accentUse` (sparse +0,25; balanced 0; rich -0,2). */
  bias: number;
  /** Halo de los trazos (`style.line.glow`, 0 a 1), para quien traza un camino continuo por su cuenta. */
  glow: number;
  /** Acento para lo secundario: con `accentUse: "sparse"` pasa a tinta; si no, `accent`. Lo principal usa `pal.accent` directo. */
  soft: string;
  /** Tiñe un color neutro hacia el acento con `accentUse: "rich"`; si no, lo devuelve igual. */
  quiet: (color: string) => string;
  /** Fracción de elementos en acento, escalada por `accentUse` (sparse x0,35; rich x2,4; tope 1). */
  share: (f: number) => number;
  /** Cada cuántos elementos uno va en acento, escalado por `accentUse` (sparse x2; rich /2). */
  every: (n: number) => number;
  /** Fija terminación y esquinas: `cap`/`join` en `true` piden redondeo (con `cap: "square"` del tema queda recto). */
  caps: (ctx: Ctx, o?: { cap?: boolean; join?: boolean }) => void;
  seg: (ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, alpha: number, width: number, o?: SegOptions) => void;
  dot: (ctx: Ctx, x: number, y: number, r: number, color: string, alpha?: number) => void;
  /** Polilínea 3D ya proyectada, tramo a tramo, con opacidad y grosor por profundidad (como `depthPolyline`). */
  polyline: (ctx: Ctx, pts: { x: number; y: number; depth: number }[], color: string, style: (depth: number) => { alpha: number; width: number }, closed?: boolean, o?: { main?: boolean }) => void;
  /** Polígono de alambre: relleno opaco y trazo (como `poly`); `guide` permite trazo discontinuo. */
  poly: (ctx: Ctx, pts: Pt[], fill: string | null, stroke: string | null, lineWidth?: number, strokeAlpha?: number, guide?: boolean) => void;
  /**
   * Cara de un sólido con color base `base` y luz `s` (0..1; `null` = el color base tal cual): se dibuja según `style.solid`
   * (sombreada, plana, solo contorno o translúcida). `habitual` es la arista de siempre de la pieza (`edge: "gap"`).
   */
  face: (ctx: Ctx, pts: Pt[], base: string, s: number | null, lineWidth: number, habitual: string | null, strokeAlpha?: number) => void;
  /** Disco (esfera, sol): con degradado `grad` si es `shaded` por defecto; plano, contorno o translúcido según `style.solid`. */
  disc: (ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number, grad?: { light: string; dark: string }) => void;
  /** Atenuación por profundidad (`lineByDepth`); con `fog: false`, trazos parejos al valor más nítido. */
  byDepth: (depth: number, near: number, far: number, o?: LineStyleOptions) => { alpha: number; width: number };
  /** Patrón de guiones (px) para un trazo continuo ya construido (`null` = lleno). */
  dashFor: (width: number, main?: boolean) => number[] | null;
}

export function penFor(theme: Theme, pal: Palette, k: number): Pen {
  const L = lineLook(theme);
  const S = solidLook(theme);
  const D = depthLook(theme);
  const w = L.widthK;
  const amp = L.sketch * 2.4 * k;
  const guideDash = L.dash !== "solid";

  const wobble = (pts: Pt[]): Pt[] => (amp > 0 ? pts.map((p) => { const o = sketchOffset(p.x, p.y, amp); return { x: p.x + o.dx, y: p.y + o.dy }; }) : pts);
  const path = (ctx: Ctx, pts: Pt[], close: boolean) => {
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
    if (close) ctx.closePath();
  };
  const dashFor = (width: number, main = false): number[] | null => {
    if (main || !guideDash) return null;
    return L.dash === "dashed" ? [Math.max(6, width * 3.4), Math.max(5, width * 2.6)] : [0.01, Math.max(4, width * 2.6)];
  };
  const stroke = (ctx: Ctx, pts: Pt[], close: boolean, color: string, alpha: number, lw: number, dash: number[] | null, built = false, join = false) => {
    if (L.glow > 0 && alpha > 0.2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw * (2.2 + 2 * L.glow);
      ctx.globalAlpha = clamp(alpha) * 0.14 * L.glow;
      if (!built) path(ctx, pts, close);
      ctx.stroke();
      built = true;
      ctx.lineWidth = lw * 1.7;
      ctx.globalAlpha = clamp(alpha) * 0.24 * L.glow;
      ctx.stroke();
    }
    ctx.globalAlpha = clamp(alpha);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    if (join) ctx.lineJoin = L.square ? "miter" : "round";
    if (dash) ctx.setLineDash(dash);
    if (!built) path(ctx, pts, close);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };
  const plain = !guideDash && amp === 0 && L.glow === 0;

  const dotShape = (ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number) => {
    if (L.dotShape === "round") return dot(ctx, x, y, r, color, alpha);
    ctx.globalAlpha = clamp(alpha);
    if (L.dotShape === "square") {
      ctx.fillStyle = color;
      ctx.fillRect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8);
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, r * 0.55);
      ctx.beginPath();
      ctx.moveTo(x - r * 1.15, y);
      ctx.lineTo(x + r * 1.15, y);
      ctx.moveTo(x, y - r * 1.15);
      ctx.lineTo(x, y + r * 1.15);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  const edgeColor = (habitual: string | null): string | null => (S.edge === "gap" ? habitual : S.edge === "ink" ? pal.ink : S.edge === "accent" ? pal.accent : null);

  const pen: Pen = {
    w,
    fog: D.fog,
    glow: L.glow,
    extrude: D.extrude,
    sparse: L.accentUse === "sparse",
    bias: L.accentUse === "sparse" ? 0.25 : L.accentUse === "rich" ? -0.2 : 0,
    soft: L.accentUse === "sparse" ? pal.ink : pal.accent,
    quiet: (c) => (L.accentUse === "rich" ? mix(c, pal.accent, 0.5) : c),
    share: (f) => (L.accentUse === "sparse" ? f * 0.35 : L.accentUse === "rich" ? Math.min(1, f * 2.4) : f),
    every: (n) => (L.accentUse === "sparse" ? n * 2 : L.accentUse === "rich" ? Math.max(2, Math.round(n / 2)) : n),
    caps: (ctx, o = {}) => {
      if (L.square) { ctx.lineCap = "butt"; ctx.lineJoin = "miter"; return; }
      if (o.cap) ctx.lineCap = "round";
      if (o.join) ctx.lineJoin = "round";
    },
    dashFor,
    byDepth: (depth, near, far, o = {}) => {
      if (D.fog) return lineByDepth(depth, near, far, o);
      const { maxAlpha = 1, minWidth = 0.8, maxWidth = 3 } = o;
      return { alpha: maxAlpha, width: lerp(minWidth, maxWidth, 0.55) };
    },
    seg: (ctx, x1, y1, x2, y2, color, alpha, width, o = {}) => {
      const lw = width * w;
      const guide = !o.main && guideDash;
      if (plain || (!guide && amp === 0 && L.glow === 0)) return seg(ctx, x1, y1, x2, y2, color, alpha, lw);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (guide && o.i !== undefined && len < 40) {
        // Tramos cortos de una polilínea: el patrón se corta por tramo (3 sí, 2 no; o un punto cada dos).
        if (L.dash === "dashed" ? o.i % 5 >= 3 : o.i % 2 !== 0) return;
        if (L.dash === "dotted") return dotShape(ctx, (x1 + x2) / 2, (y1 + y2) / 2, Math.max(1, lw * 0.6), color, alpha);
      }
      const n = amp > 0 ? Math.max(1, Math.ceil(len / 34)) : 1;
      const pts: Pt[] = [];
      for (let i = 0; i <= n; i++) pts.push({ x: lerp(x1, x2, i / n), y: lerp(y1, y2, i / n) });
      const dash = guide && !(o.i !== undefined && len < 40) ? dashFor(lw) : null;
      const prev = ctx.lineCap;
      if (dash && L.dash === "dotted") ctx.lineCap = "round";
      stroke(ctx, wobble(pts), false, color, alpha, lw, dash);
      ctx.lineCap = prev;
    },
    dot: (ctx, x, y, r, color, alpha = 1) => {
      const rr = r * L.dotK;
      if (rr <= 0) return;
      let px = x, py = y;
      if (amp > 0) { const o = sketchOffset(x, y, amp * 0.5); px += o.dx; py += o.dy; }
      if (L.glow > 0 && alpha > 0.12) {
        dot(ctx, px, py, rr * 2.7, color, alpha * 0.1 * L.glow);
        dot(ctx, px, py, rr * 1.7, color, alpha * 0.2 * L.glow);
      }
      dotShape(ctx, px, py, rr, color, alpha);
    },
    polyline: (ctx, pts, color, style, closed = false, o = {}) => {
      const n = pts.length;
      const last = closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const a = pts[i]!, b = pts[(i + 1) % n]!;
        const st = style((a.depth + b.depth) / 2);
        const lw = st.width * w;
        if (plain) seg(ctx, a.x, a.y, b.x, b.y, color, st.alpha, lw);
        else pen.seg(ctx, a.x, a.y, b.x, b.y, color, st.alpha, st.width, { main: o.main, i });
      }
    },
    poly: (ctx, pts, fill, strokeColor, lineWidth = 1, strokeAlpha = 1, guide = false) => {
      if (pts.length < 2) return;
      const P = wobble(pts);
      path(ctx, P, true);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (strokeColor) stroke(ctx, P, true, strokeColor, strokeAlpha, lineWidth * w, guide ? dashFor(lineWidth * w) : null, true, true);
    },
    face: (ctx, pts, base, s, lineWidth, habitual, strokeAlpha = 1) => {
      if (pts.length < 2) return;
      const P = wobble(pts);
      const sc = s === null ? null : S.contrast === 1 ? s : clamp(0.5 + (s - 0.5) * S.contrast);
      const lw = lineWidth * w;
      let fill: string | null;
      let fillAlpha = 1;
      let edge: string | null;
      let ea = strokeAlpha;
      switch (S.fill) {
        case "outline":
          fill = pal.bg;
          edge = S.edge === "ink" || S.edge === "accent" ? edgeColor(null) : mix(base, pal.ink, 0.25);
          ea = Math.max(strokeAlpha, 0.9);
          break;
        case "translucent":
          fill = base;
          fillAlpha = 0.26;
          edge = S.edge === "gap" ? mix(base, pal.ink, 0.3) : edgeColor(null);
          ea = Math.max(strokeAlpha, 0.9);
          break;
        case "flat": {
          const tone = base === pal.accent ? base : mix(base, pal.bg, 0.42);
          fill = sc === null ? tone : mix(tone, pal.lightest, (sc - 0.5) * 0.14 * S.contrast);
          edge = edgeColor(habitual);
          break;
        }
        default:
          fill = sc === null ? base : shadeColor(base, sc, pal);
          edge = edgeColor(habitual);
      }
      path(ctx, P, true);
      ctx.fillStyle = fill;
      if (fillAlpha < 1) {
        ctx.globalAlpha = fillAlpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else ctx.fill();
      if (edge) stroke(ctx, P, true, edge, ea, lw, null, true, true);
    },
    disc: (ctx, x, y, r, color, alpha, grad) => {
      const circle = () => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };
      ctx.globalAlpha = alpha;
      if (S.fill === "outline") {
        ctx.fillStyle = pal.bg;
        circle();
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2 * k * w;
        circle();
        ctx.stroke();
      } else if (S.fill === "translucent") {
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha * 0.3;
        circle();
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2 * k * w;
        circle();
        ctx.stroke();
      } else if (grad && S.fill === "shaded") {
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
        g.addColorStop(0, grad.light);
        g.addColorStop(1, grad.dark);
        ctx.fillStyle = g;
        circle();
        ctx.fill();
      } else {
        ctx.fillStyle = color;
        circle();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };

  return pen;
}
