import { borderWidth } from "../themes";
import type { Theme } from "../themes";
import { clamp } from "./util";

/** Rectángulo en las coordenadas de quien lo usa (del mundo dentro de `World`, de pantalla fuera). */
export type Rect = { x: number; y: number; w: number; h: number };

export type Side = "right" | "left" | "above" | "below";

export interface PlaceOptions {
  /** Cosas que la pieza no debería tapar (otras etiquetas, números, tarjetas). El objetivo mismo se evita siempre. */
  avoid?: Rect[];
  /** Zona donde tiene que quedar completa (por ejemplo el área segura, o lo que ve la cámara). Sin ella no se acota. */
  within?: Rect;
  /** Orden de preferencia de los lados. Por defecto `right`, `below`, `left`, `above`. */
  prefer?: Side[];
  /** Separación en px con el objetivo. Por defecto 16. */
  gap?: number;
}

export interface Placement {
  /** Esquina superior izquierda, en enteros (con `left`/`top` fraccionarios la captura depende del historial de cuadros). */
  x: number;
  y: number;
  /** De qué lado del objetivo quedó. */
  side: Side;
  /** Área (px²) que pisa de los `avoid`. 0 = quedó en lugar libre. */
  overlap: number;
  /** Índices de `avoid` que pisa (vacío si quedó libre): esos son los que conviene apagar con `coveredOpacity` mientras la pieza esté. */
  covers: number[];
}

const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Grandes en px² para que un candidato que pisa el objetivo nunca gane a uno que solo pisa otras cosas. */
const TARGET_PENALTY = 1e6;

/**
 * Dónde poner una pieza de tamaño `size` (una burbuja, una pastilla de aviso) junto a un `target`, sin pisar nada si hay lugar.
 * Prueba cada lado de `prefer` (derecha, abajo, izquierda y arriba por defecto) con la pieza centrada, al comienzo y al final del borde del
 * objetivo, la mete dentro de `within` y se queda con el primer candidato que no pisa ningún `avoid` ni el objetivo; si ninguno queda libre,
 * elige el que menos área pisa (a igualdad, el de mejor lado en `prefer`) y dice qué pisa en `covers`.
 * Es una función pura: la misma entrada da siempre la misma salida, sin azar ni medidas del DOM.
 *
 * ```ts
 * const p = placeBeside(card, { w: 260, h: 56 }, { avoid: otherLabels, within: safeRect, prefer: ["above", "right"] });
 * ```
 */
export function placeBeside(target: Rect, size: { w: number; h: number }, o: PlaceOptions = {}): Placement {
  const avoid = o.avoid ?? [];
  const gap = o.gap ?? 16;
  const sides = o.prefer?.length ? o.prefer : (["right", "below", "left", "above"] as Side[]);
  const win = o.within;
  const fit = (x: number, y: number) =>
    win
      ? { x: Math.round(clamp(x, win.x, Math.max(win.x, win.x + win.w - size.w))), y: Math.round(clamp(y, win.y, Math.max(win.y, win.y + win.h - size.h))) }
      : { x: Math.round(x), y: Math.round(y) };
  let best: (Placement & { score: number }) | null = null;
  for (const side of sides) {
    for (const t of [0.5, 0, 1]) {
      // t reparte la pieza a lo largo del borde del objetivo: 0,5 centrada, 0 alineada al comienzo, 1 al final
      const dx = t * (target.w - size.w), dy = t * (target.h - size.h);
      const raw =
        side === "right" ? { x: target.x + target.w + gap, y: target.y + dy }
        : side === "left" ? { x: target.x - gap - size.w, y: target.y + dy }
        : side === "below" ? { x: target.x + dx, y: target.y + target.h + gap }
        : { x: target.x + dx, y: target.y - gap - size.h };
      const { x, y } = fit(raw.x, raw.y);
      const box = { x, y, w: size.w, h: size.h };
      const covers: number[] = [];
      let overlap = 0;
      avoid.forEach((r, i) => {
        const a = area(box, r);
        if (a > 0) { covers.push(i); overlap += a; }
      });
      const onTarget = area(box, target);
      const score = overlap + (onTarget > 0 ? TARGET_PENALTY + onTarget : 0);
      if (score === 0) return { x, y, side, overlap: 0, covers: [] };
      if (!best || score < best.score) best = { x, y, side, overlap, covers, score };
    }
  }
  const { score: _s, ...out } = best!;
  return out;
}

export interface CalloutStateOptions {
  /** Cuadros de entrada y de salida. Por defecto 10. */
  ramp?: number;
}

/**
 * Progreso (0 a 1) de una pieza que está en pantalla entre `range[0]` y `range[1]`: sube en los primeros `ramp` cuadros, se sostiene y baja
 * en los últimos `ramp` (con rango más corto que `2 * ramp`, el fundido se acorta). Antes y después vale 0. Es lo que gobierna a la vez a
 * la pieza (`Callout`) y a lo que ella tapa (`coveredOpacity`): una sola cuenta compartida, así las dos mitades no se desincronizan.
 */
export function calloutState(frame: number, range: [number, number], o: CalloutStateOptions = {}): number {
  const [a, b] = range;
  if (!(b > a)) return 0;
  const r = Math.max(1, Math.min(o.ramp ?? 10, (b - a) / 2));
  return clamp(Math.min((frame - a) / r, (b - frame) / r), 0, 1);
}

/**
 * Opacidad de lo que una pieza tapa mientras está en pantalla: 1 con `progress` 0 y `floor` con `progress` 1 (por defecto 0: se apaga
 * del todo, y un texto casi transparente deja de contar como pisado). Un `floor` mayor que ~0,25 deja el texto legible por debajo de la pieza
 * y `qa` lo informa como solapado: usalo solo si lo tapado no tiene texto.
 */
export function coveredOpacity(progress: number, floor = 0): number {
  return 1 - clamp(progress, 0, 1) * (1 - clamp(floor, 0, 1));
}

export interface HeadlineStripOptions {
  /** Disposición del titular (`DockedHeadline layout`). Por defecto `stacked`. */
  layout?: "stacked" | "inline";
  /** `DockedHeadline size`. Por defecto `md`. */
  size?: "md" | "sm";
  /** Si el titular lleva subtítulo (apilado, la píldora es más alta). Por defecto `true`: el caso más alto. */
  subtitle?: boolean;
  /** Aire extra bajo la píldora, en px. Por defecto 16. */
  gap?: number;
}

/**
 * La franja de arriba que el titular fijo (`DockedHeadline`) ocupa mientras es visible, en coordenadas de pantalla (la escala 1 del mundo):
 * de borde a borde del cuadro, desde y = 0 hasta el pie de la píldora más `gap`. El contenido de la escena tiene que quedar **debajo** de
 * `y + h` en los cuadros en que el titular se ve (cámara en escala 1 hasta `hideFromScale`: se aparta pasando de 1,08); con la cámara
 * acercada el titular no está y la franja no rige. Se calcula con las mismas medidas que `DockedHeadline` (`safe.y / 2` arriba, relleno
 * `eyebrow * 0,45`, título `caption` a 1,15 de interlínea, subtítulo a 1,2) y borde del design system; es conservadora: redondea para arriba.
 *
 * ```ts
 * const strip = headlineStrip(theme, { width, height });
 * const panelTop = strip.y + strip.h;       // el panel empieza acá, no en 190 a mano
 * ```
 */
export function headlineStrip(theme: Theme, format: { width: number; height?: number }, o: HeadlineStripOptions = {}): Rect {
  const k = o.size === "sm" ? 0.85 : 1;
  const caption = theme.type.caption * k, eyebrow = theme.type.eyebrow * k;
  const stacked = (o.layout ?? "stacked") === "stacked" && o.subtitle !== false;
  const text = caption * 1.15 + (stacked ? eyebrow * 0.85 * 1.2 : 0);
  const border = borderWidth(theme, "headline");
  const pill = Math.ceil(text + 2 * (eyebrow * 0.45) + 2 * Math.max(border, 1));
  const bottom = theme.safe.y / 2 + pill + (o.gap ?? 16);
  return { x: 0, y: 0, w: format.width, h: Math.ceil(bottom) };
}

/** Qué parte del mundo ve la cámara (coordenadas del mundo) en un cuadro: el cuadro entero dividido por la escala, centrado en el foco. */
export function cameraView(cam: { x: number; y: number; scale: number }, format: { width: number; height: number }): Rect {
  const w = format.width / cam.scale, h = format.height / cam.scale;
  return { x: cam.x - w / 2, y: cam.y - h / 2, w, h };
}

export interface KeepClearOptions {
  /** Franja que hay que dejar libre (de `headlineStrip`). Solo rige con el titular a la vista: ver `visibleBelow`. */
  strip?: Rect;
  /** Tamaño del cuadro (el del formato). */
  format: { width: number; height: number };
  /** Margen a los bordes en px de pantalla. Por defecto 40. */
  margin?: number;
  /** El titular se ve mientras la escala es <= este valor (por defecto 1,08, como `hideFromScale`). Con una escala mayor la franja no rige y solo se cuida el margen. */
  visibleBelow?: number;
}

/**
 * Receta para elegir una clave de cámara que muestre **entero** un sujeto (`subject`, en coordenadas del mundo) sin dejarlo bajo el titular.
 * Parte de la clave pedida (`{ x, y, scale }`: el foco y el zoom que querías) y corre el foco lo mínimo para que el sujeto quede dentro del
 * cuadro (con `margin`) y, si el titular se va a ver a esa escala, debajo de la franja. Devuelve la clave corregida y `fits: false` si el sujeto
 * no cabe a esa escala (hay que alejar la cámara o achicar el sujeto: la clave queda con el sujeto centrado en la zona libre).
 *
 * ```ts
 * const strip = headlineStrip(theme, format);
 * const k = cameraKeepClear({ x: 960, y: 540, scale: 1 }, panelRect, { strip, format });
 * const KEYS = [{ f: 0, ...k }, ...];       // k.fits === false: el panel no cabe bajo el titular a escala 1
 * ```
 */
export function cameraKeepClear(key: { x: number; y: number; scale: number }, subject: Rect, o: KeepClearOptions): { x: number; y: number; scale: number; fits: boolean } {
  const s = key.scale;
  const m = o.margin ?? 40;
  const { width: W, height: H } = o.format;
  const stripBottom = o.strip && s <= (o.visibleBelow ?? 1.08) ? o.strip.y + o.strip.h : 0;
  const top = Math.max(m, stripBottom);
  const axis = (focus: number, lo: number, len: number, screenLo: number, screenHi: number, size: number) => {
    // pantalla = (mundo - foco) * s + size / 2; se pide screenLo <= pantalla(lo) y pantalla(lo + len) <= screenHi
    const maxFocus = lo + (size / 2 - screenLo) / s;     // el borde de arriba/izquierda no baja de screenLo
    const minFocus = lo + len - (screenHi - size / 2) / s; // el de abajo/derecha no pasa de screenHi
    if (minFocus > maxFocus) return { v: (minFocus + maxFocus) / 2, ok: false };
    return { v: clamp(focus, minFocus, maxFocus), ok: true };
  };
  const ax = axis(key.x, subject.x, subject.w, m, W - m, W);
  const ay = axis(key.y, subject.y, subject.h, top, H - m, H);
  return { x: Math.round(ax.v), y: Math.round(ay.v), scale: s, fits: ax.ok && ay.ok };
}
