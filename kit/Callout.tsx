import { borderWidth, entrance, readableOn, surfaceStyle, textStyle, useTheme } from "../themes";
import type { Theme } from "../themes";
import { calloutState, placeBeside } from "./layout";
import type { Placement, Rect, Side } from "./layout";
import { textWidth } from "./text";
import { useFrameOr } from "./util";

export interface CalloutLayoutOptions {
  /** Lo que señala, en las coordenadas donde se dibuja la pieza (del mundo si va dentro de `World`). */
  target: Rect;
  /** El texto (una línea). */
  text: string;
  /** Tamaño de letra en px (por defecto `theme.type.caption`). */
  size?: number;
  /** Cosas que no debería tapar. Las que no pueda evitar quedan en `covers` para que la escena las apague mientras la pieza está. */
  avoid?: Rect[];
  /** Zona donde tiene que quedar completa (el área segura, o lo que ve la cámara: `cameraView`). */
  within?: Rect;
  prefer?: Side[];
  gap?: number;
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
 * Dónde cae un `Callout` y qué tapa: `placeBeside` con la caja medida. Es lo que usa la pieza; llamalo también desde la escena para saber
 * qué `covers` apagar con `coveredOpacity(calloutState(frame, range))`.
 */
export function calloutPlacement(theme: Theme, o: CalloutLayoutOptions): Placement & { w: number; h: number } {
  const box = calloutBox(theme, o.text, o.size);
  const p = placeBeside(o.target, box, { avoid: o.avoid, within: o.within, prefer: o.prefer, gap: o.gap });
  return { ...p, w: box.w, h: box.h };
}

/**
 * Pastilla o burbuja anclada a un objetivo: se pone sola en el lugar libre al lado (`placeBeside`) en vez de a un píxel fijo que pisa otra etiqueta,
 * y si no hay lugar libre se pone sobre lo menos importante y la escena apaga lo que queda debajo (`calloutState` / `coveredOpacity`).
 *
 * ```tsx
 * const range: [number, number] = [60, 110];
 * const place = calloutPlacement(theme, { target: card, text: "Acá", avoid: labels, within: safe });
 * const p = calloutState(frame, range);
 * labels.map((r, i) => <Etiqueta style={{ opacity: place.covers.includes(i) ? coveredOpacity(p) : 1 }} />);
 * <Callout target={card} text="Acá" range={range} avoid={labels} within={safe} />
 * ```
 *
 * Sale del design system: superficie `chip` encendida (`surfaceStyle`: esquinas, relleno, borde de acento y sombra), rótulo `textStyle("label")`,
 * entrada `entrance` (sube 16 px por defecto; el tema puede pedir otra), color del texto por `readableOn` sobre el relleno. La caja es de ancho
 * medido (`textWidth`) y alto de interlínea explícita (`lineHeight` en px), y lleva `minWidth` en lugar de `width`: con otra tipografía crece, no se corta.
 * Función pura del cuadro: no guarda estado. Sin `frame` toma el del motor.
 */
export function Callout({ frame, range, ramp, ...o }: CalloutLayoutOptions & { range: [number, number]; frame?: number; ramp?: number }) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const p = calloutState(f, range, { ramp });
  if (p <= 0) return null;
  const size = o.size ?? theme.type.caption;
  const box = calloutBox(theme, o.text, size);
  const at = calloutPlacement(theme, o);
  const surf = surfaceStyle(theme, "chip", { on: true });
  const ent = entrance(theme, p, 0, { native: "rise", distance: 16 });
  const fill = typeof surf.background === "string" ? surf.background : theme.color.surface;
  return (
    <div
      key={Object.keys(ent).join("-")}
      style={{
        position: "absolute", left: at.x, top: at.y, minWidth: box.w, height: box.h, boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", padding: `0 ${box.padX}px`,
        ...surf, ...ent, zIndex: 80, pointerEvents: "none",
        fontSize: size, lineHeight: `${box.lineHeight}px`, color: readableOn(theme, fill), ...textStyle(theme, "label"),
      }}
    >
      {o.text}
    </div>
  );
}
