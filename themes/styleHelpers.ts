import type React from "react";
import type { Theme } from "./types";
import { mixColors, withAlpha } from "./color";
import { contrastRatio } from "./contrast";
import { DEFAULT_STYLE, resolveStyle } from "./style";
import type { CornerRole, SurfaceRole } from "./styleTypes";

export { backgroundLayer, backgroundSamples } from "./styleBackground";
export type { BackgroundLayer } from "./styleBackground";

/*
 * Ayudas puras y deterministas que las piezas llaman para leer `theme.style`; ninguna lleva estado ni azar. Devuelven estilos
 * simples que OMITEN los valores identidad (sin `translateY(0px)`, `scale(1)` ni `opacity: 1`), como `xform` y `fade` de `fx/core`
 * (no se importan de ahí: `themes/` no depende de `fx/`). Una pieza no compara cadenas del estilo: pide lo que necesita acá.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const num = (n: number, d: number) => String(+n.toFixed(d));

// ---------- forma ----------

/**
 * Radio (px) de un rol según `style.shape.corners`.
 * `pill` (por defecto): chip y barra = `radius.pill`, tarjeta y panel = `radius.lg`, cartel = `radius.lg * 2`, control = `radius.md`.
 * `rounded`: chip = `radius.md`, tarjeta y panel = `radius.lg`, cartel = `radius.lg * 1.5`, control y barra = `radius.sm`.
 * `sharp`: 0 en todo.
 */
export function cornerRadius(theme: Theme, role: CornerRole): number {
  const r = theme.radius;
  switch (resolveStyle(theme).shape.corners) {
    case "sharp":
      return 0;
    case "rounded":
      return { chip: r.md, card: r.lg, panel: r.lg, hero: r.lg * 1.5, control: r.sm, bar: r.sm }[role];
    default:
      return { chip: r.pill, card: r.lg, panel: r.lg, hero: r.lg * 2, control: r.md, bar: r.pill }[role];
  }
}

/**
 * Grosor (px) del borde de una superficie: `shape.border` más lo propio de la pieza (chip +1, píldora +2, como hoy: 2 y 3 px con el
 * valor por defecto). 0 si `shape.outlined` es `false` (salvo `surface.kind: "outline"`, que es un borde) y para el cartel sólido.
 */
export function borderWidth(theme: Theme, role: SurfaceRole): number {
  const st = resolveStyle(theme);
  const base = st.shape.border;
  if (st.surface.kind === "outline" && role !== "title") return Math.max(base, 1) + (role === "chip" ? 1 : role === "pill" ? 2 : 0);
  if (!st.shape.outlined || base <= 0) return 0;
  if (role === "title") return st.story.titleCard === "glass" || st.surface.kind === "glass" ? base : 0;
  return base + (role === "chip" ? 1 : role === "pill" ? 2 : 0);
}

const ROLE_RADIUS: Record<SurfaceRole, CornerRole> = { card: "card", panel: "panel", headline: "chip", chip: "chip", pill: "chip", title: "hero" };
const ROLE_LEVEL: Record<SurfaceRole, "md" | "lg"> = { card: "md", panel: "lg", headline: "md", chip: "md", pill: "lg", title: "lg" };

export interface SurfaceOptions {
  /** Superficie destacada: borde de acento (chip encendido). Por defecto `true` solo en la píldora. */
  on?: boolean;
  /** Con `on`: borde más tenue (chips ya vistos). */
  faint?: boolean;
  /** 0 a 1: destello de acento (el "pop" de un chip, el brillo de una píldora). Solo con elevación `shadow` o `glow`. */
  glow?: number;
  /** Escalón de sombra (`sm`, `md`, `lg`) en vez del que corresponde al rol. */
  level?: "sm" | "md" | "lg";
}

/**
 * Fondo, borde, sombra y radio de una superficie según `style.shape` y `style.surface`; con el estilo por defecto da exactamente lo que
 * dibujaban `DockedHeadline`, `Chip`, `Pill`, `NotificationStack` y el cartel de la apertura.
 *
 * - `surface.kind`: `solid` = `color.surface`; `glass` = `surface` con `surface.opacity` (la emulación del vidrio: sin `backdrop-filter`);
 *   `outline` = relleno del fondo (opaco) y borde de tinta (`color.text`); `tinted` = `surface` teñida 10 % de acento.
 * - `surface.elevation`: `shadow` = la sombra del tema; `flat` = ninguna; `border` = filo duro desplazado en tinta; `glow` = halo de acento y borde de acento.
 * - El rol `title` (cartel de la apertura) usa vidrio si `story.titleCard` es `glass`, y agrega su sombra larga en `shadow`.
 * El estilo que devuelve no lleva `padding`, `transform` ni `opacity`: eso lo decide la pieza.
 */
export function surfaceStyle(theme: Theme, role: SurfaceRole, o: SurfaceOptions = {}): React.CSSProperties {
  const st = resolveStyle(theme);
  const c = theme.color;
  const kind = role === "title" && st.story.titleCard === "glass" ? "glass" : st.surface.kind;
  const on = o.on ?? role === "pill";
  const w = borderWidth(theme, role);
  const out: React.CSSProperties = { borderRadius: cornerRadius(theme, ROLE_RADIUS[role]) };

  out.background = kind === "glass" ? withAlpha(c.surface, st.surface.opacity) : kind === "outline" ? c.bg : kind === "tinted" ? mixColors(c.surface, c.accent, 0.1) : c.surface;

  if (w > 0) {
    let col = kind === "outline" ? c.text : c.border;
    if (kind === "glass") col = withAlpha(c.surface, 0.9);
    if (st.surface.elevation === "border") col = c.text;
    if (st.surface.elevation === "glow") col = withAlpha(c.accent, 0.45);
    if (on) col = withAlpha(c.accent, role === "pill" ? 0.66 : o.faint ? 0.3 : 0.55);
    out.border = `${num(w, 2)}px solid ${col}`;
  }

  const level = o.level ?? ROLE_LEVEL[role];
  const glow = clamp01(o.glow ?? 0);
  const parts: string[] = [];
  switch (st.surface.elevation) {
    case "shadow":
    case "glow": {
      if (st.surface.elevation === "shadow") {
        if (role === "title") parts.push(`0 40px 90px -30px ${withAlpha(c.text, 0.35)}`);
        parts.push(theme.shadow[level]);
      } else {
        const r = role === "panel" || role === "title" ? 44 : 24;
        parts.push(`0 0 ${r}px ${withAlpha(c.accent, 0.3)}`);
      }
      if (role === "pill") parts.push(`0 0 ${num(18 + glow * 34, 2)}px ${withAlpha(c.accent, 0.25 + glow * 0.4)}`);
      else if (glow > 0.01) parts.push(`0 0 ${num(10 + glow * 34, 2)}px ${withAlpha(c.accent, 0.45 * glow)}`);
      break;
    }
    case "border": {
      const d = role === "panel" || role === "title" || role === "card" ? 4 : 3;
      parts.push(`${d}px ${d}px 0 0 ${c.text}`);
      break;
    }
    default:
      break;
  }
  if (parts.length) out.boxShadow = parts.join(", ");
  return out;
}

// ---------- texto ----------

/**
 * Peso e interletrado de un rol de texto. `title`: `titleWeight` y `titleTracking`; `label`: `labelWeight`; `eyebrow`: caja alta y
 * `eyebrowTracking` (el peso lo deja a la pieza). `tracking` es lo que la pieza ya lleva (por ejemplo -0,02 em en los nombres de la lista):
 * el del estilo se suma. Omite `letterSpacing` y `textTransform` cuando no cambian nada.
 */
export function textStyle(theme: Theme, role: "title" | "label" | "eyebrow", o: { tracking?: number } = {}): React.CSSProperties {
  const st = resolveStyle(theme).type;
  const out: React.CSSProperties = {};
  const extra = role === "title" ? st.titleTracking : role === "eyebrow" ? st.eyebrowTracking : 0;
  const ls = +((o.tracking ?? 0) + extra).toFixed(3);
  if (role === "title") out.fontWeight = theme.font.weights[st.titleWeight];
  if (role === "label") out.fontWeight = theme.font.weights[st.labelWeight];
  if (role === "eyebrow" && st.eyebrowCase === "upper") out.textTransform = "uppercase";
  if (ls !== 0) out.letterSpacing = `${ls}em`;
  return out;
}

export interface GradientOptions {
  /** Cuadro (para el vaivén del degradado). */
  frame?: number;
  /** Cuadros de un vaivén; por defecto `style.decor.gradientLoop` (0 = quieto). */
  loop?: number;
}

/** Degradado de marca como texto, con el mismo vaivén (exacto en cada ciclo) que `GradientText`. */
function gradientText(theme: Theme, o: GradientOptions): React.CSSProperties {
  const loop = o.loop ?? resolveStyle(theme).decor.gradientLoop;
  const panning = loop > 0;
  const phase = panning ? Math.sin((((o.frame ?? 0) % loop) / loop) * Math.PI * 2) : 0;
  return {
    background: theme.gradient.brand,
    backgroundSize: panning ? "200% 100%" : "100% 100%",
    backgroundPosition: panning ? `${+(50 + 50 * phase).toFixed(2)}% 0` : "0% 0",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
  };
}

/**
 * Estilo de un número de paso o de lista según `style.type.numerals`: `gradient` (el degradado de marca), `solid` (el primer acento que
 * llega a 4,5:1 sobre `on`, por defecto `surface`; si ninguno, el texto), `outline` (solo contorno de acento: para cifras grandes) o `muted`.
 */
export function numeralStyle(theme: Theme, o: GradientOptions & { on?: string } = {}): React.CSSProperties {
  const c = theme.color;
  switch (resolveStyle(theme).type.numerals) {
    case "solid": {
      const bg = o.on ?? c.surface;
      return { color: [c.accent, c.accent2].find((x) => contrastRatio(x, bg) >= 4.5) ?? c.text };
    }
    case "outline":
      return { color: "transparent", WebkitTextFillColor: "transparent", WebkitTextStroke: `2px ${c.accent}` };
    case "muted":
      return { color: c.textMuted };
    default:
      return gradientText(theme, o);
  }
}

/**
 * Estilo de una palabra resaltada dentro de un texto según `style.type.highlight`: `gradient`, `accent` (color de acento),
 * `underline` (filete de acento bajo la palabra) o `marker` (marcador translúcido detrás). `progress` (0 a 1) lo va dibujando de izquierda a
 * derecha (solo `underline` y `marker`; el resto aparece completo).
 */
export function highlightStyle(theme: Theme, o: GradientOptions & { progress?: number } = {}): React.CSSProperties {
  const c = theme.color;
  const p = clamp01(o.progress ?? 1);
  const bar = (color: string, size: string, pos: string): React.CSSProperties => ({
    backgroundImage: `linear-gradient(${color}, ${color})`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: pos,
    backgroundSize: `${num(p * 100, 2)}% ${size}`,
  });
  switch (resolveStyle(theme).type.highlight) {
    case "accent":
      return { color: c.accent };
    case "underline":
      return bar(c.accent, "0.09em", "0 96%");
    case "marker":
      return bar(withAlpha(c.accent, 0.35), "52%", "0 88%");
    default:
      return gradientText(theme, o);
  }
}

// ---------- movimiento ----------

/** Cuadros de demora del elemento `index` de un conjunto escalonado: `index * style.motion.stagger`. */
export function staggerFrames(theme: Theme, index: number, o: { base?: number } = {}): number {
  const s = resolveStyle(theme).motion.stagger;
  // con `base` (el paso propio de la pieza), el tema lo escala respecto del paso por defecto: 4 cuadros = sin cambio
  return o.base === undefined ? index * s : index * o.base * (s / DEFAULT_STYLE.motion.stagger);
}

/**
 * Factor (`stagger / 4`) para las piezas que escalonan con una fracción de su duración (`staggerT(p, i, n, spread)`) y no con cuadros:
 * `spread * staggerScale(theme)`, con tope en 0,95. 1 con el valor por defecto.
 */
export const staggerScale = (theme: Theme): number => resolveStyle(theme).motion.stagger / DEFAULT_STYLE.motion.stagger;

/** Curva de asentado con rebote: 0 en 0, 1 en 1, y pasa de 1 hasta `overshoot` (fracción) antes de volver. Con `overshoot` 0 es la identidad. */
export function settle(p: number, overshoot: number): number {
  const t = clamp01(p);
  if (overshoot <= 0) return t;
  const s = overshoot * 17.0158; // 1,70158 da ~10 % de rebote
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

export interface EntranceOptions {
  /** Entrada propia de la pieza: la que se usa con `motion.entrance: "auto"` (por defecto, `rise`). Con otro valor, manda el tema. */
  native?: "rise" | "fade" | "scale" | "slide" | "wipe";
  /** Distancia (px) de `rise` (24 por defecto) y de `slide` (48). */
  distance?: number;
  /** `scale`: escala de partida (0,85). */
  from?: number;
  /** `slide`: lado de donde entra (`left` por defecto). */
  side?: "left" | "right";
  /** `slide`: los elementos de índice impar entran del lado contrario. */
  alternate?: boolean;
  /** Traslados a px enteros (por defecto `true`: el texto con traslados fraccionarios se rasteriza según el historial). */
  round?: boolean;
}

/**
 * Entrada de un elemento genérico según `style.motion.entrance` (con `auto`, la `native` de la pieza) y `overshoot`. `progress` (0 a 1) ya viene con la demora de
 * `staggerFrames` y la curva de la pieza; `index` solo decide el lado en `slide` con `alternate`.
 * En reposo (`progress` >= 1) devuelve `{}`: sin `opacity`, `transform` ni `clipPath`. Con `progress` <= 0 devuelve `opacity: 0`.
 */
export function entrance(theme: Theme, progress: number, index = 0, o: EntranceOptions = {}): React.CSSProperties {
  const st = resolveStyle(theme).motion;
  const p = clamp01(progress);
  if (p >= 1) return {};
  const q = settle(p, st.overshoot);
  const tr = (v: number) => (o.round === false ? +v.toFixed(2) : Math.round(v));
  const op = p <= 0 ? 0 : +p.toFixed(4) >= 0.9995 ? undefined : +p.toFixed(4);
  const out: React.CSSProperties = {};
  const parts: string[] = [];
  switch (st.entrance === "auto" ? o.native ?? "rise" : st.entrance) {
    case "wipe":
      return p <= 0 ? { opacity: 0 } : { clipPath: `inset(0 ${num((1 - p) * 100, 2)}% 0 0)` };
    case "fade":
      break;
    case "scale": {
      const sc = +((o.from ?? 0.85) + (1 - (o.from ?? 0.85)) * q).toFixed(4);
      if (sc !== 1) parts.push(`scale(${num(sc, 4)})`);
      break;
    }
    case "slide": {
      const dir = (o.side ?? "left") === "left" ? -1 : 1;
      const x = tr((1 - q) * (o.distance ?? 48) * (o.alternate && index % 2 === 1 ? -dir : dir));
      if (x !== 0) parts.push(`translateX(${x}px)`);
      break;
    }
    default: {
      const y = tr((1 - q) * (o.distance ?? 24));
      if (y !== 0) parts.push(`translateY(${y}px)`);
    }
  }
  if (op !== undefined) out.opacity = op;
  if (parts.length) out.transform = parts.join(" ");
  return out;
}

/**
 * Velo de transición entre escenas según `style.motion.transition`, con `progress` de 0 a 1: `wash` (opacidad), `wipe` (cortina de izquierda a
 * derecha), `cut` (un escalón al final) o `through` (`null`: sin velo; la escena siguiente entra sobre el fondo que sigue). Devuelve el estilo
 * del velo (`background` y lo que anima; la pieza pone `position`, `inset` y `zIndex`) o `null` si no hay nada que dibujar. Sin identidades: cerrado
 * del todo, un `wash` o un `wipe` no lleva `opacity` ni `clipPath`.
 */
export function transitionVeil(theme: Theme, progress: number, color?: string): { kind: "wash" | "wipe" | "cut"; style: React.CSSProperties } | null {
  const kind = resolveStyle(theme).motion.transition;
  const p = clamp01(progress);
  const background = color ?? theme.color.bg;
  if (kind === "through" || p <= 0) return null;
  if (kind === "cut") return p >= 1 ? { kind, style: { background } } : null;
  if (kind === "wipe") return { kind, style: p >= 1 ? { background } : { background, clipPath: `inset(0 ${num((1 - p) * 100, 2)}% 0 0)` } };
  return { kind, style: p >= 1 ? { background } : { background, opacity: +p.toFixed(4) } };
}

/** Opciones para `cameraAt` según `style.motion`: `tiltGain` (0,05 por defecto de la cámara, por `cameraTilt`) y `maxBlur: 0` si el desenfoque está apagado. Vacío con el estilo por defecto. */
export function cameraOptions(theme: Theme): { tiltGain?: number; maxBlur?: number } {
  const m = resolveStyle(theme).motion;
  const out: { tiltGain?: number; maxBlur?: number } = {};
  if (m.cameraTilt !== 1) out.tiltGain = +(0.05 * m.cameraTilt).toFixed(4);
  if (!m.cameraBlur) out.maxBlur = 0;
  return out;
}

// ---------- decoración ----------

/** Garabatos: `enabled` (si no, no se dibujan) y `jitter` (temblor de mano; `false` = trazo limpio). */
export function doodleStyle(theme: Theme): { enabled: boolean; jitter: boolean } {
  const d = resolveStyle(theme).decor;
  return { enabled: d.doodles, jitter: d.doodleStroke === "hand" };
}

/** Multiplicador de la viñeta (`Vignette strength`); 0 = apagada. */
export const vignetteStrength = (theme: Theme): number => resolveStyle(theme).decor.vignette;

/**
 * Marca de acento (`style.decor.accent`) de una fila de lista o de la firma: `bar` (barra de degradado de `thickness` px, la de siempre),
 * `underline` (filete fino de acento), `dot` (punto) o `none` (`null`). `length` (px) y `progress` (0 a 1) dimensionan barra y filete;
 * el punto aparece con `progress`. Las esquinas salen de `cornerRadius(theme, "bar")`.
 */
export function accentMark(theme: Theme, o: { length: number; thickness?: number; progress?: number }): { kind: "bar" | "underline" | "dot"; style: React.CSSProperties } | null {
  const kind = resolveStyle(theme).decor.accent;
  if (kind === "none") return null;
  const t = o.thickness ?? 8;
  const p = clamp01(o.progress ?? 1);
  const radius = cornerRadius(theme, "bar");
  if (kind === "dot") {
    const d = Math.round(t * 1.5);
    return { kind, style: { width: d, height: d, borderRadius: theme.radius.pill, background: theme.color.accent, ...(p < 1 ? { opacity: +p.toFixed(4) } : {}) } };
  }
  const width = Math.round(o.length * p);
  if (kind === "underline") return { kind, style: { width, height: Math.max(2, Math.round(t * 0.4)), borderRadius: radius, background: theme.color.accent } };
  return { kind, style: { width, height: t, borderRadius: radius, background: theme.gradient.brand } };
}

// ---------- gráficos ----------

/** Estilo de gráficos resuelto: radio de las barras en px (de `theme.radius`), grosor de línea, líneas de guía y relleno. */
export function chartStyle(theme: Theme): { barRadius: number; lineWidth: number; grid: "auto" | "on" | "off"; fill: "solid" | "gradient" | "hatched" } {
  const ch = resolveStyle(theme).chart;
  const r = theme.radius;
  const barRadius = ch.barRadius === "none" ? 0 : r[ch.barRadius];
  return { barRadius, lineWidth: ch.lineWidth, grid: ch.grid, fill: ch.fill };
}

export type ChartFill =
  | { kind: "solid"; fill: string }
  | { kind: "gradient"; id: string; fill: string; stops: { offset: number; color: string; opacity: number }[] }
  | { kind: "hatched"; id: string; fill: string; base: string; line: string; spacing: number; angle: number; width: number };

/**
 * Relleno de una barra o área de color `color` según `style.chart.fill`. `solid` da el color tal cual; `gradient` y `hatched` piden un
 * elemento de `<defs>` con el `id` que se pasa (derivado de las props, nunca de `useId`) y devuelven su descripción para dibujarlo:
 * `gradient` = vertical del color pleno a 55 %; `hatched` = rayas a 45 grados sobre una base de 18 %.
 */
export function chartFill(theme: Theme, color: string, id: string): ChartFill {
  const kind = resolveStyle(theme).chart.fill;
  const safe = `ve-fill-${id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  if (kind === "gradient") return { kind, id: safe, fill: `url(#${safe})`, stops: [{ offset: 0, color, opacity: 1 }, { offset: 1, color, opacity: 0.55 }] };
  if (kind === "hatched") return { kind, id: safe, fill: `url(#${safe})`, base: withAlpha(color, 0.18), line: color, spacing: 10, angle: 45, width: 3 };
  return { kind: "solid", fill: color };
}

// ---------- historias ----------

/** Forma de `StoryDesign` (`stories/types.ts`) que cubre lo que el tema decide; `stories/` acepta además `clouds`. */
export interface StoryStyleDesign {
  titleCard: "solid" | "glass";
  list: { layout: "stacked" | "inline"; underline: "row" | "name" };
  handoff: "wash" | "dock" | "through";
  headline: { size: "md" | "sm" };
  gradient?: { loop: number };
  closing: { bg: string; bar: boolean };
  wall: { columns?: number; rows?: number; blur: { opening: boolean; closing: boolean }; chipScale: number; dolly: number; depth: number };
}

/** Valores por defecto de `StoryDesign` que decide el tema (`style.story` y `style.decor.gradientLoop`), en la forma larga de cada opción. */
export function storyDefaults(theme: Theme): StoryStyleDesign {
  const s = resolveStyle(theme);
  const w = s.story;
  return {
    titleCard: w.titleCard,
    list: { layout: w.listLayout, underline: w.listUnderline },
    handoff: w.handoff,
    headline: { size: w.headlineSize },
    ...(s.decor.gradientLoop >= 2 ? { gradient: { loop: s.decor.gradientLoop } } : {}),
    closing: { bg: w.closingBg, bar: w.signoffBar },
    wall: {
      ...(w.wallColumns !== null ? { columns: w.wallColumns } : {}),
      ...(w.wallRows !== null ? { rows: w.wallRows } : {}),
      blur: { opening: w.wallBlurOpening, closing: w.wallBlurClosing },
      chipScale: w.wallChipScale,
      dolly: w.wallDolly,
      depth: w.wallDepth,
    },
  };
}

type Loose = Record<string, unknown>;

/**
 * `spec.design` de un video sobre los valores del tema: lo que el video indica gana, lo demás sale de `storyDefaults(theme)`.
 * Acepta las formas cortas de `StoryDesign` (`list: "inline"`, `wall.blur: false`) y devuelve siempre la larga; el resto de las claves
 * (por ejemplo `clouds`) pasa tal cual.
 */
export function withStoryDefaults<D extends object>(theme: Theme, design?: D): D & StoryStyleDesign {
  const base = storyDefaults(theme) as unknown as Loose;
  const d = { ...((design ?? {}) as Loose) };
  const list = typeof d.list === "string" ? { layout: d.list } : (d.list as Loose | undefined);
  const wall = { ...((d.wall as Loose | undefined) ?? {}) };
  const blur = wall.blur;
  if (typeof blur === "boolean") wall.blur = { opening: blur, closing: blur };
  const grp = (k: string, v: Loose | undefined) => ({ ...(base[k] as Loose), ...(v ?? {}) });
  const wallBase = base.wall as Loose;
  return {
    ...base,
    ...d,
    list: grp("list", list),
    headline: grp("headline", d.headline as Loose | undefined),
    closing: grp("closing", d.closing as Loose | undefined),
    ...(base.gradient || d.gradient ? { gradient: grp("gradient", d.gradient as Loose | undefined) } : {}),
    wall: { ...wallBase, ...wall, blur: { ...(wallBase.blur as Loose), ...((wall.blur as Loose | undefined) ?? {}) } },
  } as unknown as D & StoryStyleDesign;
}
