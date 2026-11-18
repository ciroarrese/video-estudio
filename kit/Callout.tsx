import type React from "react";
import { annotationLook, borderWidth, cornerRadius, entrance, readableOn, surfaceStyle, textStyle, useTheme, withAlpha } from "../themes";
import type { AnnotationMark, AnnotationMarkSetting, Theme } from "../themes";
import { arrowPoints, circlePoints, pointsToString } from "./doodle";
import { calloutState, decideBeside, placeBeside } from "./layout";
import type { BesideDecision, Placement, Rect, Side } from "./layout";
import { signalAttrs } from "./signal";
import { textWidth } from "./text";
import { clamp, useFrameOr } from "./util";

export interface CalloutLayoutOptions {
  /** Lo que señala, en las coordenadas donde se dibuja la pieza (del mundo si va dentro de `World`). */
  target: Rect;
  /** El texto (una línea). Sin texto, la pieza es solo la señal (anillo, corchete, subrayado o foco; una flecha o una etiqueta sin texto pasan a anillo; con `none`, nada). */
  text?: string;
  /** Tamaño de letra en px (por defecto `theme.type.caption`). */
  size?: number;
  /** Cosas que no debería tapar. Las que no pueda evitar quedan en `covers` para que la escena las apague mientras la pieza está. */
  avoid?: Rect[];
  /** Zona donde tiene que quedar completa (el área segura, o lo que ve la cámara: `cameraView`). */
  within?: Rect;
  prefer?: Side[];
  /**
   * Lado y alineación **ya decididos** (`calloutDecision`, una sola vez): la pastilla ocupa siempre ese lado y esa alineación y solo sigue al objetivo,
   * en vez de elegir de nuevo en cada cuadro según el lugar libre. Con la cámara en movimiento el lugar libre cambia cuadro a cuadro y una etiqueta
   * que decide siempre salta de lado. Sin `fixed` el comportamiento es el de siempre.
   */
  fixed?: BesideDecision;
  /** Separación con el objetivo. Por defecto la de la señal (la flecha pide más aire que la etiqueta pegada). */
  gap?: number;
  /**
   * Forzar otra señal que la del design system (`style.annotation.mark`): la excepción explícita, para el caso en que la escena sabe algo que
   * el tema no (un subrayado donde el tema pone flecha). Sin `variant` manda el tema; no la uses por costumbre.
   */
  variant?: AnnotationMarkSetting;
  /** Semilla del temblor de la señal `hand` (por defecto, el texto). */
  id?: string;
}

/** Aire con el objetivo por defecto de cada señal (px): las que unen con una línea necesitan lugar para dibujarla. */
const MARK_GAP: Record<AnnotationMark, number> = { hand: 92, arrow: 96, elbow: 88, bracket: 44, tag: 6, ring: 38, focus: 38, underline: 26, none: 16 };

/** La señal que se dibuja de verdad: sin texto, las que necesitan un rótulo pasan a `ring`. */
function effectiveMark(theme: Theme, o: Pick<CalloutLayoutOptions, "text" | "variant">): AnnotationMark {
  const m = annotationLook(theme, o.variant).mark;
  if (o.text) return m;
  return m === "hand" || m === "arrow" || m === "elbow" || m === "tag" ? "ring" : m;
}

/** Caja medida de la pieza: ancho por el texto medido (`textWidth`), alto por la interlínea explícita. */
export function calloutBox(theme: Theme, text: string, size = theme.type.caption): { w: number; h: number; lineHeight: number; padX: number; padY: number } {
  const b = borderWidth(theme, "chip") ;
  const lineHeight = Math.ceil(size * 1.25);
  const padX = Math.round(size * 0.7), padY = Math.round(size * 0.35);
  const w = Math.ceil(textWidth(theme, text, { size, role: "label" })) + 2 * padX + 2 * b + 2;
  return { w, h: lineHeight + 2 * padY + 2 * b, lineHeight, padX, padY };
}

/**
 * Dónde cae un `Callout` y qué tapa: `placeBeside` con la caja medida y el aire de la señal del tema. Es lo que usa la pieza; llamalo también desde la
 * escena para saber qué `covers` apagar con `coveredOpacity(calloutState(frame, range))`. Sin texto no hay rótulo que ubicar: `w` y `h` valen 0.
 */
export function calloutPlacement(theme: Theme, o: CalloutLayoutOptions): Placement & { w: number; h: number; mark: AnnotationMark } {
  const mark = effectiveMark(theme, o);
  if (!o.text) return { x: o.target.x, y: o.target.y, side: "right", overlap: 0, covers: [], w: 0, h: 0, mark };
  const box = calloutBox(theme, o.text, o.size);
  const p = placeBeside(o.target, box, {
    avoid: o.avoid, within: o.within, gap: o.gap ?? MARK_GAP[mark],
    ...(o.fixed ? { prefer: [o.fixed.side], align: o.fixed.align } : { prefer: o.prefer }),
  });
  return { ...p, w: box.w, h: box.h, mark };
}

/**
 * Decide lado y alineación de un `Callout` **una sola vez**, con el objetivo donde va a quedar asentado (por ejemplo, proyectado con la cámara final
 * de su señal; ver `projectRect`) y el lugar libre de ese momento. Se pasa el resultado a `fixed` en cada cuadro: la pastilla ya no cambia de lado
 * mientras la cámara viaja. Con las mismas opciones que `calloutPlacement` (menos `fixed`). Sin texto no hay pastilla que ubicar: devuelve `right` y 0,5.
 */
export function calloutDecision(theme: Theme, o: Omit<CalloutLayoutOptions, "fixed">): BesideDecision {
  if (!o.text) return { side: "right", align: 0.5 };
  const mark = effectiveMark(theme, o);
  const box = calloutBox(theme, o.text, o.size);
  const d = decideBeside(o.target, box, { avoid: o.avoid, within: o.within, prefer: o.prefer, gap: o.gap ?? MARK_GAP[mark] });
  return { side: d.side, align: d.align };
}

/**
 * Opacidad con que la escena atenúa lo que no es el objetivo mientras dura una señal `focus` (`style.annotation.dim`); 1 con cualquier otra señal.
 * `progress` es `calloutState(frame, range)`. Aplicala a un contenedor de lo demás (no al objetivo ni al `Callout`), y no sobre texto que tenga que leerse
 * en ese momento: un texto atenuado se calcula contra el fondo (`docs/guia-escenas.md`, sección 15).
 */
export function focusOpacity(theme: Theme, progress: number, variant?: AnnotationMarkSetting): number {
  const look = annotationLook(theme, variant);
  return look.mark === "focus" ? +(1 - look.dim * clamp(progress, 0, 1)).toFixed(4) : 1;
}

type Pt = { x: number; y: number };
const nearest = (r: Rect, p: Pt): Pt => ({ x: clamp(p.x, r.x, r.x + r.w), y: clamp(p.y, r.y, r.y + r.h) });
const r1 = (n: number) => +n.toFixed(1);

/** Punto del borde de la pastilla que mira al objetivo. */
function pillAnchor(side: Side, pill: Rect): Pt {
  return side === "right" ? { x: pill.x, y: pill.y + pill.h / 2 }
    : side === "left" ? { x: pill.x + pill.w, y: pill.y + pill.h / 2 }
    : side === "below" ? { x: pill.x + pill.w / 2, y: pill.y }
    : { x: pill.x + pill.w / 2, y: pill.y + pill.h };
}

const pathOf = (pts: Pt[]) => "M" + pts.map((p) => `${r1(p.x)} ${r1(p.y)}`).join(" L");

/** Rectángulo con esquinas (`rx`) como camino SVG (para el recorte del foco y para el anillo). */
function roundRectPath(x: number, y: number, w: number, h: number, rx: number): string {
  const r = Math.max(0, Math.min(rx, w / 2, h / 2));
  return `M${r1(x + r)} ${r1(y)}H${r1(x + w - r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + w)} ${r1(y + r)}V${r1(y + h - r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + w - r)} ${r1(y + h)}H${r1(x + r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x)} ${r1(y + h - r)}V${r1(y + r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + r)} ${r1(y)}Z`;
}



/**
 * Pastilla o señal anclada a un objetivo, **con la forma que usa el design system** (`style.annotation.mark`): `hand` (flecha curva a mano), `arrow`
 * (flecha recta con cabeza), `elbow` (línea con codo y punto en el objetivo), `bracket` (corchete al margen), `tag` (etiqueta pegada, sin flecha),
 * `ring` (anillo con las esquinas del tema y su halo), `focus` (anillo; lo demás lo atenúa `FocusGroup`), `underline` (subrayado) o `none` (solo el
 * rótulo). Un tema que no declara `annotation` se deriva de `decor` (ver `annotationLook`). Para forzar otra: `variant`, como excepción explícita.
 * Se pone sola en el lugar libre al lado (`placeBeside`) en vez de a un píxel fijo que pisa otra etiqueta, y si no hay lugar libre se pone sobre lo
 * menos importante y la escena apaga lo que queda debajo (`calloutState` / `coveredOpacity`).
 *
 * ```tsx
 * const range: [number, number] = [60, 110];
 * const place = calloutPlacement(theme, { target: card, text: "Acá", avoid: labels, within: safe });
 * const p = calloutState(frame, range);
 * labels.map((r, i) => <Etiqueta style={{ opacity: place.covers.includes(i) ? coveredOpacity(p) : 1 }} />);
 * <Callout target={card} text="Acá" range={range} avoid={labels} within={safe} />
 * ```
 *
 * El rótulo sale del design system: superficie `chip` encendida (`surfaceStyle`: esquinas, relleno, borde de acento y sombra), rótulo `textStyle("label")`,
 * entrada `entrance` (sube 16 px por defecto; el tema puede pedir otra), color del texto por `readableOn` sobre el relleno. La caja es de ancho
 * medido (`textWidth`) y alto de interlínea explícita (`lineHeight` en px), y lleva `minWidth` en lugar de `width`: con otra tipografía crece, no se corta.
 * El trazo de la señal es de acento con el grosor, la terminación y el halo de `style.line`; se dibuja con el progreso de `calloutState` (el mismo que
 * la pastilla). Función pura del cuadro: no guarda estado. Sin `frame` toma el del motor.
 *
 * `focus` dibuja el anillo y deja atenuar el resto a `FocusGroup` (kit/FocusGroup.tsx), que envuelve todo lo que NO es el objetivo y le aplica `focusOpacity(theme, calloutState(frame, range), variant?)`
 * (1 con la señal apagada, `1 - annotation.dim` con ella puesta). La pieza no dibuja una capa translúcida encima: tapa el objetivo y hay que recortarle un hueco; una opacidad en
 * el contenedor, sin `isolation`, `will-change` ni `filter`, pasa `render --check --check-all`. Con las otras señales vale 1.
 */
export function Callout({ frame, range, ramp, overlay, ...o }: CalloutLayoutOptions & {
  range: [number, number]; frame?: number; ramp?: number;
  /** La pieza es una capa fija en espacio de pantalla (fuera de `World`): agrega `data-qa-overlay` a la pastilla y al trazo (ver `kit/README.md`). */
  overlay?: boolean;
}) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const p = calloutState(f, range, { ramp });
  const look = annotationLook(theme, o.variant);
  const mark = effectiveMark(theme, o);
  if (p <= 0) return null;
  const showPill = !!o.text;
  if (!showPill && mark === "none") return null;
  const size = o.size ?? theme.type.caption;
  const at = calloutPlacement(theme, o);
  const pill: Rect = { x: at.x, y: at.y, w: at.w, h: at.h };
  const seed = o.id ?? o.text ?? "callout";
  return (
    <>
      <CalloutMark ov={overlay} theme={theme} mark={mark} target={o.target} pill={showPill ? pill : null} side={at.side} p={p} frame={f} seed={seed} look={look} />
      {showPill && <CalloutPill ov={overlay} theme={theme} text={o.text!} size={size} at={at} p={p} forced={look.forced} />}
    </>
  );
}

const OV = { "data-qa-overlay": "true" } as const;

function CalloutPill({ ov, theme, text, size, at, p, forced }: { ov?: boolean; theme: Theme; text: string; size: number; at: { x: number; y: number }; p: number; forced: boolean }) {
  const box = calloutBox(theme, text, size);
  const surf = surfaceStyle(theme, "chip", { on: true });
  const ent = entrance(theme, p, 0, { native: "rise", distance: 16 });
  const fill = typeof surf.background === "string" ? surf.background : theme.color.surface;
  return (
    <div
      key={Object.keys(ent).join("-")}
      {...signalAttrs(theme, "callout", "Callout", forced)}
      {...(ov ? OV : {})}
      style={{
        position: "absolute", left: at.x, top: at.y, minWidth: box.w, height: box.h, boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", padding: `0 ${box.padX}px`,
        ...surf, ...ent, zIndex: 80, pointerEvents: "none",
        fontSize: size, lineHeight: `${box.lineHeight}px`, color: readableOn(theme, fill), ...textStyle(theme, "label"),
      }}
    >
      {text}
    </div>
  );
}

/** El trazo de la señal. `p` (0 a 1) es el progreso de `calloutState`: dibuja el trazo. */
function CalloutMark({ ov, theme, mark, target, pill, side, p, frame, seed, look }: {
  ov?: boolean; theme: Theme; mark: AnnotationMark; target: Rect; pill: Rect | null; side: Side; p: number; frame: number; seed: string; look: ReturnType<typeof annotationLook>;
}) {
  const accent = theme.color.accent;
  const sw = Math.max(2, Math.round(4 * look.widthK));
  const cap = look.square ? "butt" : "round", join = look.square ? "miter" : "round";
  const full = p >= 1;
  // trazo que se dibuja con el progreso (pathLength normalizado); en reposo no deja `dasharray` ni `dashoffset`
  const draw = full ? {} : { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: +(1 - p).toFixed(4) };
  const stroke = (d: string, extra: { width?: number; color?: string; fill?: string } = {}) => (
    <path d={d} fill={extra.fill ?? "none"} stroke={extra.color ?? accent} strokeWidth={extra.width ?? sw} strokeLinecap={cap} strokeLinejoin={join} {...(extra.fill ? {} : draw)} />
  );
  const halo = (d: string) => (look.glow > 0 ? <path d={d} fill="none" stroke={withAlpha(accent, 0.35 * look.glow)} strokeWidth={sw * 3.2} strokeLinecap={cap} strokeLinejoin={join} {...draw} /> : null);
  const svg = (children: React.ReactNode, z = 79) => (
    <svg key={full ? "full" : "part"} {...signalAttrs(theme, "callout", "Callout", look.forced)} {...(ov ? OV : {})} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", zIndex: z }} width={1} height={1}>{children}</svg>
  );
  const A = pill ? pillAnchor(side, pill) : null;

  if ((mark === "arrow" || mark === "elbow" || mark === "hand") && A) {
    const c = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
    const horiz = side === "right" || side === "left";
    // punto del objetivo al que llega la señal: el borde más cercano al rótulo; en `elbow` se corre hacia el centro para que el codo se vea
    // `hand` rodea el objetivo con un óvalo a mano y la flecha llega al óvalo, no al objetivo
    const reach = mark === "hand" ? 16 : 0;
    let B = nearest({ x: target.x - reach, y: target.y - reach, w: target.w + 2 * reach, h: target.h + 2 * reach }, A);
    if (mark === "elbow") {
      const sgn = (horiz ? A.y : A.x) < (horiz ? c.y : c.x) ? 1 : -1;
      B = horiz
        ? { x: B.x, y: clamp(A.y + sgn * target.h * 0.25, target.y + target.h * 0.15, target.y + target.h * 0.85) }
        : { x: clamp(A.x + sgn * target.w * 0.25, target.x + target.w * 0.15, target.x + target.w * 0.85), y: B.y };
    }
    const len = Math.hypot(A.x - B.x, A.y - B.y);
    if (len < 12) return null;
    const ux = (B.x - A.x) / len, uy = (B.y - A.y) / len;
    const tip = { x: B.x - ux * 4, y: B.y - uy * 4 };
    if (mark === "elbow") {
      const stub = clamp(len * 0.4, 14, 44);
      const E = horiz ? { x: A.x + Math.sign(B.x - A.x) * stub, y: A.y } : { x: A.x, y: A.y + Math.sign(B.y - A.y) * stub };
      const d = pathOf([A, E, B]);
      return svg(<>{halo(d)}{stroke(d)}<circle cx={r1(B.x)} cy={r1(B.y)} r={sw * 1.7 + 1} fill={accent} opacity={full ? undefined : +p.toFixed(4)} /></>);
    }
    if (mark === "arrow") {
      const hl = 14 + sw * 3, hw = hl * 0.46;
      const base = { x: tip.x - ux * hl, y: tip.y - uy * hl };
      const d = pathOf([A, base]);
      const head = `M${r1(tip.x)} ${r1(tip.y)} L${r1(base.x - uy * hw)} ${r1(base.y + ux * hw)} L${r1(base.x + uy * hw)} ${r1(base.y - ux * hw)} Z`;
      return svg(<>{halo(d)}{stroke(d)}{p > 0.9 && <path d={head} fill={accent} stroke={accent} strokeWidth={1} strokeLinejoin={join} />}</>);
    }
    // hand: óvalo y curva con temblor sembrado (el mismo trazo que `DoodleCircle` y `DoodleArrow`), cabeza en dos rayas
    const oval = circlePoints(seed, frame, c.x, c.y, target.w / 2 + reach, target.h / 2 + reach, 3, true);
    const ovalDraw = Math.min(1, p * 1.6);
    const pts = arrowPoints(seed, frame, A.x, A.y, tip.x, tip.y, 0.22, 3, true);
    const shown = pts.slice(0, Math.max(2, Math.round(p * pts.length)));
    const [ax, ay] = shown[shown.length - 1]!, [bx, by] = shown[shown.length - 2]!;
    const ang = Math.atan2(ay - by, ax - bx);
    const hd = (dd: number): [number, number] => [ax - Math.cos(ang + dd) * 30, ay - Math.sin(ang + dd) * 30];
    return svg(<>
      <polyline points={oval} fill="none" stroke={accent} strokeWidth={sw + 1} strokeLinecap="round" strokeLinejoin="round" {...(ovalDraw >= 1 ? {} : { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: +(1 - ovalDraw).toFixed(4) })} />
      <polyline points={pointsToString(shown)} fill="none" stroke={accent} strokeWidth={sw + 1} strokeLinecap="round" strokeLinejoin="round" />
      {p > 0.95 && <polyline points={pointsToString([hd(0.5), [ax, ay], hd(-0.5)])} fill="none" stroke={accent} strokeWidth={sw + 1} strokeLinecap="round" strokeLinejoin="round" />}
    </>);
  }

  if (mark === "ring" || mark === "focus") {
    const pad = mark === "focus" ? 8 : 10;
    const rx = cornerRadius(theme, "control") + pad;
    const x = target.x - pad, y = target.y - pad, w = target.w + 2 * pad, h = target.h + 2 * pad;
    const ring = roundRectPath(x, y, w, h, rx);
        return (
      <>
        {svg(<>{halo(ring)}{stroke(ring)}</>)}
      </>
    );
  }

  if (mark === "bracket") {
    // el corchete es la señal más discreta: con un trazo fino (hairline) se perdía bajo la tarjeta, así que lleva remates largos y un trazo de al menos 3 px
    const pad = 14, tick = 18, over = 6;
    const horiz = side === "right" || side === "left";
    const s = side === "right" || side === "below" ? 1 : -1;
    let pts: Pt[];
    let stubTo: Pt | null = null;
    if (horiz) {
      const sx = s > 0 ? target.x + target.w + pad : target.x - pad;
      const y1 = target.y - over, y2 = target.y + target.h + over;
      pts = [{ x: sx - s * tick, y: y1 }, { x: sx, y: y1 }, { x: sx, y: y2 }, { x: sx - s * tick, y: y2 }];
      if (pill) {
        const y = clamp(clamp(pill.y + pill.h / 2, y1, y2), pill.y + 3, pill.y + pill.h - 3);
        if (y >= y1 && y <= y2) stubTo = { x: s > 0 ? pill.x : pill.x + pill.w, y };
        if (stubTo) pts = [...pts, { x: NaN, y: NaN }, { x: sx, y }, stubTo];
      }
    } else {
      const sy = s > 0 ? target.y + target.h + pad : target.y - pad;
      const x1 = target.x - over, x2 = target.x + target.w + over;
      pts = [{ x: x1, y: sy - s * tick }, { x: x1, y: sy }, { x: x2, y: sy }, { x: x2, y: sy - s * tick }];
      if (pill) {
        const x = clamp(clamp(pill.x + pill.w / 2, x1, x2), pill.x + 3, pill.x + pill.w - 3);
        if (x >= x1 && x <= x2) stubTo = { x, y: s > 0 ? pill.y : pill.y + pill.h };
        if (stubTo) pts = [...pts, { x: NaN, y: NaN }, { x, y: sy }, stubTo];
      }
    }
    const cut = pts.findIndex((q) => Number.isNaN(q.x));
    const spine = cut < 0 ? pts : pts.slice(0, cut);
    const stub = cut < 0 ? null : pts.slice(cut + 1);
    const d = pathOf(spine) + (stub ? " " + pathOf(stub) : "");
    return svg(<>{halo(d)}{stroke(d, { width: Math.max(3, Math.round(4 * look.widthK)) })}</>);
  }

  if (mark === "underline") {
    const y = target.y + target.h + 7;
    const d = pathOf([{ x: target.x, y }, { x: target.x + target.w, y }]);
    return svg(<>{halo(d)}{stroke(d)}</>);
  }

  // `tag` y `none`: sin trazo; el rótulo es la señal
  return null;
}
