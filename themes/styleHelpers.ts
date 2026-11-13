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
 * Radio (px) de un rol según `style.shape.corners`; cada rol sale de un escalón de `theme.radius`:
 * `pill` (por defecto): chip y barra = `radius.pill`, tarjeta y ventana = `radius.lg`, panel = `radius.panel`, cartel = `radius.lg * 2`, control = `radius.md`.
 * `rounded`: chip = `radius.md`, tarjeta y ventana = `radius.lg`, panel = `radius.panel`, cartel = `radius.lg * 1.5`, control y barra = `radius.sm`.
 * `sharp`: 0 en todo.
 * `shape.heroScale` (si no es `null`) reemplaza el múltiplo del cartel: `radius.lg * heroScale` en `pill` y en `rounded`.
 * `panel` es el contenedor de tamaño medio (un panel dentro de una interfaz, un paso de un diagrama); `window` es el grande (la paleta de
 * comandos, el plano, el panel que ocupa la escena) y `card` la tarjeta suelta.
 */
export function cornerRadius(theme: Theme, role: CornerRole): number {
  const r = theme.radius;
  const sh = resolveStyle(theme).shape;
  switch (sh.corners) {
    case "sharp":
      return 0;
    case "rounded":
      return { chip: r.md, card: r.lg, panel: r.panel, window: r.lg, hero: r.lg * (sh.heroScale ?? 1.5), control: r.sm, bar: r.sm }[role];
    default:
      return { chip: r.pill, card: r.lg, panel: r.panel, window: r.lg, hero: r.lg * (sh.heroScale ?? 2), control: r.md, bar: r.pill }[role];
  }
}

/**
 * Grosor (px) del borde de una superficie: `shape.border` más lo propio de la pieza (chip +1, píldora +2, como hoy: 2 y 3 px con el
 * valor por defecto). 0 si `shape.outlined` es `false` (salvo `surface.kind: "outline"`, que es un borde) y para el cartel sólido.
 * - `bold`: un píxel más (la ficha que tiene que leerse como objeto: las tarjetas de `fx/three`, la tarjeta de un recorrido; con el valor por
 *   defecto, 2 px en vez de 1). Quien lo necesita lo pide acá y no suma a mano.
 * - `titleCard`: variante del cartel (`solid` o `glass`) del video; por defecto la que declara el tema (`story.titleCard`).
 * Con `surface.kind: "outline"` el cartel también lleva borde (es el propio contorno del cartel, sin el cual se confunde con el fondo).
 */
export function borderWidth(theme: Theme, role: SurfaceRole, o: Pick<SurfaceOptions, "bold" | "titleCard"> = {}): number {
  const st = resolveStyle(theme);
  const base = st.shape.border;
  const bold = o.bold ? 1 : 0;
  if (st.surface.kind === "outline") return Math.max(base, 1) + (role === "chip" ? 1 : role === "pill" ? 2 : 0) + bold;
  if (!st.shape.outlined || base <= 0) return 0;
  if (role === "title") return (o.titleCard ?? st.story.titleCard) === "glass" || st.surface.kind === "glass" ? base + bold : 0;
  return base + (role === "chip" ? 1 : role === "pill" ? 2 : 0) + bold;
}

const ROLE_RADIUS: Record<SurfaceRole, CornerRole> = { card: "card", panel: "panel", window: "window", headline: "chip", chip: "chip", pill: "chip", title: "hero" };
const ROLE_LEVEL: Record<SurfaceRole, "md" | "lg"> = { card: "md", panel: "lg", window: "lg", headline: "md", chip: "md", pill: "lg", title: "lg" };

export interface SurfaceOptions {
  /** Superficie destacada: borde de acento (chip encendido). Por defecto `true` solo en la píldora. */
  on?: boolean;
  /** Con `on`: borde más tenue (chips ya vistos). */
  faint?: boolean;
  /** 0 a 1: destello de acento (el "pop" de un chip, el brillo de una píldora). Solo con elevación `shadow` o `glow`. */
  glow?: number;
  /** Escalón de sombra (`sm`, `md`, `lg`) en vez del que corresponde al rol. */
  level?: "sm" | "md" | "lg";
  /** Borde un píxel más grueso (ver `borderWidth`). */
  bold?: boolean;
  /** Rol de esquinas distinto del que corresponde a la superficie (una tarjeta con las esquinas de `panel`). */
  corner?: CornerRole;
  /** Solo con el rol `title`: variante del cartel que decidió el video; por defecto la del tema (`story.titleCard`). */
  titleCard?: "solid" | "glass";
}

/** Partes de una superficie, sin CSS: lo que necesita un SVG (`<rect>`, sombras dibujadas a mano) y lo que arma `surfaceStyle`. */
export interface SurfaceParts {
  /** Relleno. */
  fill: string;
  /** Borde (color y grosor en px), o `null` si la superficie no lleva. */
  stroke: { color: string; width: number } | null;
  /** Radio de las esquinas (px). */
  radius: number;
  /**
   * Elevación: `soft` (la sombra del tema, `theme.shadow.*`: no se descompone, ver `boxShadow`), `hard` (filo duro desplazado `x`, `y` en tinta),
   * `glow` (halo de acento de `blur` px) o `none`.
   */
  shadow: { kind: "none" | "soft" | "hard" | "glow"; x: number; y: number; blur: number; color: string };
  /** Destello de acento extra (el "pop" de un chip, el brillo de la píldora), o `null`. Es otra capa, sobre la elevación. */
  glow: { blur: number; color: string } | null;
  /** Las sombras juntas como valor CSS de `box-shadow` (`undefined` si no hay). */
  boxShadow: string | undefined;
}

/**
 * Fondo, borde, sombra y radio de una superficie como datos (`SurfaceParts`) según `style.shape` y `style.surface`; `surfaceStyle` es lo mismo
 * escrito como CSS. Las piezas SVG usan esta variante: no hay que leer cadenas de CSS.
 */
export function surfaceParts(theme: Theme, role: SurfaceRole, o: SurfaceOptions = {}): SurfaceParts {
  const st = resolveStyle(theme);
  const c = theme.color;
  const card = role === "title" ? (o.titleCard ?? st.story.titleCard) : undefined;
  const kind = card === "glass" ? "glass" : st.surface.kind;
  const on = o.on ?? role === "pill";
  const w = borderWidth(theme, role, o);

  const fill = kind === "glass" ? withAlpha(c.surface, st.surface.opacity) : kind === "outline" ? c.bg : kind === "tinted" ? mixColors(c.surface, c.accent, 0.1) : c.surface;

  let stroke: SurfaceParts["stroke"] = null;
  if (w > 0) {
    let col = kind === "outline" ? c.text : c.border;
    if (kind === "glass") col = withAlpha(c.surface, 0.9);
    if (st.surface.elevation === "border") col = c.text;
    if (st.surface.elevation === "glow") col = withAlpha(c.accent, 0.45);
    if (on) col = withAlpha(c.accent, role === "pill" ? 0.66 : o.faint ? 0.3 : 0.55);
    stroke = { color: col, width: w };
  }

  const level = o.level ?? ROLE_LEVEL[role];
  const g = clamp01(o.glow ?? 0);
  const big = role === "panel" || role === "window" || role === "title";
  const layers: string[] = [];
  let shadow: SurfaceParts["shadow"] = { kind: "none", x: 0, y: 0, blur: 0, color: c.text };
  let glow: SurfaceParts["glow"] = null;
  switch (st.surface.elevation) {
    case "shadow":
    case "glow": {
      if (st.surface.elevation === "shadow") {
        if (role === "title") layers.push(`0 40px 90px -30px ${withAlpha(c.text, 0.35)}`);
        layers.push(theme.shadow[level]);
        shadow = { kind: "soft", x: 0, y: 0, blur: 0, color: c.text };
      } else {
        const r = big ? 44 : 24;
        const col = withAlpha(c.accent, 0.3);
        layers.push(`0 0 ${r}px ${col}`);
        shadow = { kind: "glow", x: 0, y: 0, blur: r, color: col };
      }
      if (role === "pill") glow = { blur: +(18 + g * 34).toFixed(2), color: withAlpha(c.accent, 0.25 + g * 0.4) };
      else if (g > 0.01) glow = { blur: +(10 + g * 34).toFixed(2), color: withAlpha(c.accent, 0.45 * g) };
      if (glow) layers.push(`0 0 ${num(glow.blur, 2)}px ${glow.color}`);
      break;
    }
    case "border": {
      const d = big || role === "card" ? 4 : 3;
      layers.push(`${d}px ${d}px 0 0 ${c.text}`);
      shadow = { kind: "hard", x: d, y: d, blur: 0, color: c.text };
      break;
    }
    default:
      break;
  }
  return { fill, stroke, radius: cornerRadius(theme, o.corner ?? ROLE_RADIUS[role]), shadow, glow, boxShadow: layers.length ? layers.join(", ") : undefined };
}

/**
 * Fondo, borde, sombra y radio de una superficie como CSS (`surfaceParts` escrito para un elemento HTML); con el estilo por defecto da
 * exactamente lo que dibujaban `DockedHeadline`, `Chip`, `Pill`, `NotificationStack` y el cartel de la apertura.
 *
 * - `surface.kind`: `solid` = `color.surface`; `glass` = `surface` con `surface.opacity` (la emulación del vidrio: sin `backdrop-filter`);
 *   `outline` = relleno del fondo (opaco) y borde de tinta (`color.text`); `tinted` = `surface` teñida 10 % de acento.
 * - `surface.elevation`: `shadow` = la sombra del tema; `flat` = ninguna; `border` = filo duro desplazado en tinta; `glow` = halo de acento y borde de acento.
 * - El rol `title` (cartel de la apertura) usa vidrio si `story.titleCard` es `glass` (o `titleCard` en las opciones, la variante que eligió
 *   el video), y agrega su sombra larga en `shadow`.
 * El estilo que devuelve no lleva `padding`, `transform` ni `opacity`: eso lo decide la pieza.
 */
export function surfaceStyle(theme: Theme, role: SurfaceRole, o: SurfaceOptions = {}): React.CSSProperties {
  const p = surfaceParts(theme, role, o);
  const out: React.CSSProperties = { borderRadius: p.radius, background: p.fill };
  if (p.stroke) out.border = `${num(p.stroke.width, 2)}px solid ${p.stroke.color}`;
  if (p.boxShadow) out.boxShadow = p.boxShadow;
  return out;
}

// ---------- texto ----------

const STRONGER = { regular: "medium", medium: "semibold", semibold: "stat", stat: "stat" } as const;

/**
 * Peso e interletrado de un rol de texto. `title`: `titleWeight` y `titleTracking`; `label`: `labelWeight`; `eyebrow`: caja alta y
 * `eyebrowTracking` (el peso lo deja a la pieza); `caption`: subtítulos y líneas de apoyo de las historias, con su propia caja
 * (`captionCase`), interletrado (`captionTracking`) y peso (`captionWeight`). `tracking` es lo que la pieza ya lleva (por ejemplo -0,02 em en los nombres de la lista):
 * el del estilo se suma. Omite `letterSpacing` y `textTransform` cuando no cambian nada.
 * `strong` (solo en `label`): el rótulo que va un escalón más fuerte que el común (los nombres de una tarjeta, la etiqueta de una ficha):
 * `labelWeight` subido un escalón (`regular` a `medium`, `medium` a `semibold`, `semibold` a `stat`). Con el estilo por defecto, `semibold`.
 * `caption`: con `captionCase: "eyebrow"` y `captionTracking: null` (por defecto) sigue al eyebrow, así que un design system que no los toca no
 * cambia; `follow: false` hace que "seguir al eyebrow" signifique "no tocar" (la línea de la lista, que nunca llevó caja ni interletrado del estilo).
 */
export function textStyle(theme: Theme, role: "title" | "label" | "eyebrow" | "caption", o: { tracking?: number; strong?: boolean; follow?: boolean } = {}): React.CSSProperties {
  const st = resolveStyle(theme).type;
  const out: React.CSSProperties = {};
  const follow = o.follow !== false;
  const captionTracking = st.captionTracking ?? (follow ? st.eyebrowTracking : 0);
  const extra = role === "title" ? st.titleTracking : role === "eyebrow" ? st.eyebrowTracking : role === "caption" ? captionTracking : 0;
  const ls = +((o.tracking ?? 0) + extra).toFixed(3);
  if (role === "title") out.fontWeight = theme.font.weights[st.titleWeight];
  if (role === "label") out.fontWeight = theme.font.weights[o.strong ? STRONGER[st.labelWeight] : st.labelWeight];
  if (role === "eyebrow" && st.eyebrowCase === "upper") out.textTransform = "uppercase";
  if (role === "caption") {
    const kase = st.captionCase === "eyebrow" ? (follow && st.eyebrowCase === "upper" ? "upper" : "as-is") : st.captionCase;
    if (kase === "upper") out.textTransform = "uppercase";
    else if (kase === "lower") out.textTransform = "lowercase";
    if (st.captionWeight !== "auto") out.fontWeight = theme.font.weights[st.captionWeight];
  }
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

/** Contextos de escalonado con paso propio en `style.motion`: la lista de la apertura, las filas, los elementos pequeños y las piezas del muro. */
export type StaggerContext = "list" | "rows" | "items" | "chips";

const STAGGER_KEY = { list: "staggerList", rows: "staggerRows", items: "staggerItems", chips: "staggerChips" } as const;

/** Paso (cuadros) que el design system fija para un contexto (`motion.staggerList`, `staggerRows`, `staggerItems`, `staggerChips`), o `null` si no lo fija. */
export const staggerOverride = (theme: Theme, context: StaggerContext): number | null => resolveStyle(theme).motion[STAGGER_KEY[context]];

export interface StaggerOptions {
  /** Paso propio de la pieza, en cuadros: el tema lo escala respecto del paso por defecto (4 = sin cambio). Lo ignora un paso de contexto. */
  base?: number;
  /** Contexto de la pieza: si el design system fijó el paso de ese contexto (`motion.staggerList`...), manda ese número, en cuadros, sin escalar. */
  context?: StaggerContext;
  /** Solo con un paso de contexto: multiplicador del paso (por ejemplo `dur / duraciónPorDefecto` cuando el bloque se estira con `timing`). */
  scale?: number;
}

/**
 * Cuadros de demora del elemento `index` de un conjunto escalonado. Sin `context` (o si el design system no fijó el paso de ese contexto):
 * `index * style.motion.stagger`, o `index * base * (stagger / 4)` con el paso propio de la pieza. Con un paso de contexto (`motion.staggerList`,
 * `staggerRows`, `staggerItems` o `staggerChips`): `index * paso * scale`, en cuadros, sin pasar por `base`.
 */
export function staggerFrames(theme: Theme, index: number, o: StaggerOptions = {}): number {
  const m = resolveStyle(theme).motion;
  const ctx = o.context ? m[STAGGER_KEY[o.context]] : null;
  if (ctx !== null) return index * ctx * (o.scale ?? 1);
  const s = m.stagger;
  // con `base` (el paso propio de la pieza), el tema lo escala respecto del paso por defecto: 4 cuadros = sin cambio
  return o.base === undefined ? index * s : index * o.base * (s / DEFAULT_STYLE.motion.stagger);
}

/**
 * Factor (`stagger / 4`) para las piezas que escalonan con una fracción de su duración (`staggerT(p, i, n, spread)`) y no con cuadros:
 * `spread * staggerScale(theme)`, con tope en 0,95. 1 con el valor por defecto. Con `context` y un paso de contexto fijado, el factor sale de ese paso (`paso / 4`).
 */
export const staggerScale = (theme: Theme, context?: StaggerContext): number => {
  const m = resolveStyle(theme).motion;
  return (context ? m[STAGGER_KEY[context]] ?? m.stagger : m.stagger) / DEFAULT_STYLE.motion.stagger;
};

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
  native?: "rise" | "fade" | "scale" | "slide" | "wipe" | "depth";
  /** Distancia (px) de `rise` (24 por defecto) y de `slide` (48). */
  distance?: number;
  /** `depth`: distancia en z (px) desde donde llega el elemento (600 por defecto; hasta 1300: la perspectiva es de 1400 px). */
  depth?: number;
  /** `scale`: escala de partida (0,85). */
  from?: number;
  /** `slide`: lado de donde entra (`left` por defecto). */
  side?: "left" | "right";
  /** `slide`: los elementos de índice impar entran del lado contrario. */
  alternate?: boolean;
  /** Traslados a px enteros (por defecto `true`: el texto con traslados fraccionarios se rasteriza según el historial). */
  round?: boolean;
  /**
   * Curva propia de la pieza (por ejemplo `Easing.lands`): reemplaza al asentado de `motion.overshoot` mientras la entrada es la propia
   * (`motion.entrance: "auto"`) y puede pasarse de 1 (rebote). Con otra entrada manda el tema. `progress` llega a la curva sin curvar.
   */
  curve?: (p: number) => number;
  /** Traslado extra (px) de la pieza, sumado al de la entrada en un solo `transform` (la tarjeta empujada por otra). Sin redondear si `round` es `false`. */
  offset?: { x?: number; y?: number };
}

/** Perspectiva (px) de la entrada `depth`: la misma que `flyInZ` de `kit/` por defecto. */
export const DEPTH_PERSPECTIVE = 1400;

/**
 * Entrada de un elemento genérico según `style.motion.entrance` (con `auto`, la `native` de la pieza) y `overshoot`. `progress` (0 a 1) ya viene con la demora de
 * `staggerFrames` y la curva de la pieza; `index` solo decide el lado en `slide` con `alternate`.
 * `depth` (`motion.entrance: "depth"`): el elemento llega desde `o.depth` px de profundidad con su propia `perspective()` (la regla de `docs/reglas.md`: nunca en un ancestro), igual que `flyInZ`.
 * En reposo (`progress` >= 1) devuelve `{}`: sin `opacity`, `transform` ni `clipPath` (con `offset`, solo el traslado). Con `progress` <= 0 devuelve `opacity: 0`.
 * `curve` deja que la pieza use una curva propia que se pasa de 1 (rebote) y `offset` suma un traslado extra al de la entrada.
 */
export function entrance(theme: Theme, progress: number, index = 0, o: EntranceOptions = {}): React.CSSProperties {
  const st = resolveStyle(theme).motion;
  const p = clamp01(progress);
  const ox = o.offset?.x ?? 0, oy = o.offset?.y ?? 0;
  const tr = (v: number) => (o.round === false ? +v.toFixed(2) : Math.round(v));
  // traslado extra: delante de lo que haga la entrada, como una sola función de `translate`
  const shift = (): string[] => {
    const x = tr(ox), y = tr(oy);
    return x !== 0 && y !== 0 ? [`translate(${num(x, 2)}px, ${num(y, 2)}px)`] : x !== 0 ? [`translateX(${num(x, 2)}px)`] : y !== 0 ? [`translateY(${num(y, 2)}px)`] : [];
  };
  if (p >= 1) {
    const rest = shift();
    return rest.length ? { transform: rest.join(" ") } : {};
  }
  const native = st.entrance === "auto";
  const q = native && o.curve ? o.curve(p) : settle(p, st.overshoot);
  const op = p <= 0 ? 0 : +p.toFixed(4) >= 0.9995 ? undefined : +p.toFixed(4);
  const out: React.CSSProperties = {};
  const parts: string[] = [];
  switch (native ? o.native ?? "rise" : st.entrance) {
    case "wipe": {
      const t = shift();
      return p <= 0 ? { opacity: 0, ...(t.length ? { transform: t.join(" ") } : {}) } : { clipPath: `inset(0 ${num((1 - p) * 100, 2)}% 0 0)`, ...(t.length ? { transform: t.join(" ") } : {}) };
    }
    case "fade":
      parts.push(...shift());
      break;
    case "depth": {
      // como `flyInZ` de `kit/`: perspectiva propia del elemento (nunca en un ancestro) y todo el movimiento en un solo `translate3d`
      const z = tr(Math.max(-1300, Math.min(1300, (1 - q) * (o.depth ?? 600))));
      const x = tr(ox), y = tr(oy);
      if (z !== 0) parts.push(`perspective(${DEPTH_PERSPECTIVE}px)`, `translate3d(${num(x, 2)}px, ${num(y, 2)}px, ${num(-z, 2)}px)`);
      else parts.push(...shift());
      break;
    }
    case "scale": {
      const sc = +((o.from ?? 0.85) + (1 - (o.from ?? 0.85)) * q).toFixed(4);
      parts.push(...shift());
      if (sc !== 1) parts.push(`scale(${num(sc, 4)})`);
      break;
    }
    case "slide": {
      const dir = (o.side ?? "left") === "left" ? -1 : 1;
      const x = tr((1 - q) * (o.distance ?? 48) * (o.alternate && index % 2 === 1 ? -dir : dir));
      parts.push(...shift());
      if (x !== 0) parts.push(`translateX(${num(x, 2)}px)`);
      break;
    }
    default: {
      // la distancia propia y el traslado extra se suman antes de redondear: así un solo número, igual al de siempre sin traslado extra
      const y = tr((1 - q) * (o.distance ?? 24) + oy);
      const x = tr(ox);
      if (x !== 0 && y !== 0) parts.push(`translate(${num(x, 2)}px, ${num(y, 2)}px)`);
      else if (x !== 0) parts.push(`translateX(${num(x, 2)}px)`);
      else if (y !== 0) parts.push(`translateY(${num(y, 2)}px)`);
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

/** Rol de color con que el design system tiñe la viñeta (`decor.vignetteColor`, `accent` por defecto). */
export const vignetteColor = (theme: Theme): string => resolveStyle(theme).decor.vignetteColor;

/**
 * Marca de acento (`style.decor.accent`) de una fila de lista o de la firma: `bar` (barra de degradado de `thickness` px, la de siempre),
 * `underline` (filete fino de acento), `dot` (punto) o `none` (`null`). `length` (px) y `progress` (0 a 1) dimensionan barra y filete;
 * el punto aparece con `progress`. Las esquinas salen de `cornerRadius(theme, "bar")`. `thickness` es el grosor propio de la pieza; el design system lo
 * multiplica con `decor.accentThickness` (1 = el de siempre).
 */
export function accentMark(theme: Theme, o: { length: number; thickness?: number; progress?: number }): { kind: "bar" | "underline" | "dot"; style: React.CSSProperties } | null {
  const decor = resolveStyle(theme).decor;
  const kind = decor.accent;
  if (kind === "none") return null;
  // `decor.accentThickness` multiplica el grosor propio de la pieza (8 px por defecto); con 1 es el de siempre
  const t = decor.accentThickness === 1 ? o.thickness ?? 8 : Math.max(1, Math.round((o.thickness ?? 8) * decor.accentThickness));
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
  wall: { columns?: number; rows?: number; blur: { opening: boolean; closing: boolean }; chipScale: number; dolly: number; depth: number; gapX: number; gapY: number; brick: number; jitter: number };
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
      gapX: w.wallGapX,
      gapY: w.wallGapY,
      brick: w.wallBrick,
      jitter: w.wallJitter,
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
