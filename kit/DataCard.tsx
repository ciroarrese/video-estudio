import type React from "react";
import { borderWidth, entrance, surfaceStyle, textStyle, useTheme } from "../themes";
import type { Theme } from "../themes";
import { calloutState, decideBeside, placeBeside } from "./layout";
import type { BesideDecision, Placement, Rect, Side } from "./layout";
import { textWidth } from "./text";
import { useFrameOr } from "./util";

export interface DataCardOptions {
  /** Lo que acompaña, en las coordenadas donde se dibuja la pieza (de pantalla: una capa fija junto al foco). */
  target: Rect;
  /** Rótulo del dato (una línea, va arriba, chico). */
  label: string;
  /** Valor grande (una línea): un importe, una cifra, un código que a tamaño de interfaz no se lee. */
  value: string;
  /** Lado del objetivo en que va (por defecto `right`). Si no hay lugar libre en `within`, la tarjeta se corre lo mínimo y puede pisar el objetivo: elegí un lado con aire. */
  side?: Side;
  /** Lado y alineación ya decididos (`dataCardDecision`): tiene prioridad sobre `side`. */
  fixed?: BesideDecision;
  /** Cosas que no debería tapar. */
  avoid?: Rect[];
  /** Zona donde tiene que quedar completa (el área segura). */
  within?: Rect;
  /** Separación con el objetivo (por defecto 28). */
  gap?: number;
  /** Tamaño de letra del valor en px (por defecto `0,75 * type.h2`). El rótulo usa `type.eyebrow`. */
  size?: number;
}

/** Caja medida: ancho por el texto más ancho (`textWidth`), alto por interlíneas explícitas. */
export function dataCardBox(theme: Theme, o: Pick<DataCardOptions, "label" | "value" | "size">): {
  w: number; h: number; pad: number; gap: number; labelSize: number; valueSize: number; labelLine: number; valueLine: number;
} {
  const labelSize = theme.type.eyebrow;
  const valueSize = o.size ?? Math.round(theme.type.h2 * 0.75);
  const labelLine = Math.ceil(labelSize * 1.25), valueLine = Math.ceil(valueSize * 1.15);
  const pad = Math.round(valueSize * 0.4), gap = Math.round(labelSize * 0.3);
  const b = borderWidth(theme, "card", { bold: true });
  const wl = textWidth(theme, o.label, { size: labelSize, role: "eyebrow", weight: "medium" });
  const wv = textWidth(theme, o.value, { size: valueSize, weight: "stat" });
  return { w: Math.ceil(Math.max(wl, wv)) + 2 * pad + 2 * b + 2, h: labelLine + gap + valueLine + 2 * pad + 2 * b, pad, gap, labelSize, valueSize, labelLine, valueLine };
}

const GAP = 28;
const optsOf = (o: DataCardOptions) => ({
  avoid: o.avoid, within: o.within, gap: o.gap ?? GAP,
  ...(o.fixed ? { prefer: [o.fixed.side], align: o.fixed.align } : { prefer: [o.side ?? "right"] as Side[] }),
});

/** Dónde cae la tarjeta (esquina superior izquierda, enteros), su caja y qué pisa: la misma cuenta que la pieza. */
export function dataCardPlacement(theme: Theme, o: DataCardOptions): Placement & { w: number; h: number } {
  const box = dataCardBox(theme, o);
  return { ...placeBeside(o.target, box, optsOf(o)), w: box.w, h: box.h };
}

/** Decide lado y alineación **una sola vez** (con el objetivo donde queda asentado) para pasarlos a `fixed` en cada cuadro. */
export function dataCardDecision(theme: Theme, o: Omit<DataCardOptions, "fixed">): BesideDecision & Placement & { w: number; h: number } {
  const box = dataCardBox(theme, o);
  const d = decideBeside(o.target, box, optsOf(o));
  return { ...d, w: box.w, h: box.h };
}

/**
 * Tarjeta de dato ampliado: rótulo chico y valor grande junto al foco, del lado indicado, para importes o cifras que a tamaño de interfaz no se leen.
 * Es una capa fija en espacio de pantalla (fuera de `World`; el objetivo es el rectángulo del foco ya proyectado con `projectRect`) y lleva
 * `data-qa-overlay`. Superficie de tarjeta del design system (`surfaceStyle("card")` con borde marcado), letra de `textStyle`, entrada `entrance`; la caja
 * se mide con `textWidth` y crece con otra tipografía (`minWidth`). Con `fixed` (de `dataCardDecision`) no cambia de lado mientras la cámara viaja.
 * Aparece y desaparece con `calloutState(frame, range)`.
 */
export function DataCard({ frame, range, ramp, ...o }: DataCardOptions & { range: [number, number]; frame?: number; ramp?: number }) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const p = calloutState(f, range, { ramp });
  if (p <= 0) return null;
  const box = dataCardBox(theme, o);
  const at = dataCardPlacement(theme, o);
  const ent = entrance(theme, p, 0, { native: "rise", distance: 16 });
  const style: React.CSSProperties = {
    position: "absolute", left: at.x, top: at.y, minWidth: box.w, boxSizing: "border-box", padding: box.pad, whiteSpace: "nowrap",
    ...surfaceStyle(theme, "card", { level: "md", bold: true }), ...ent, zIndex: 80, pointerEvents: "none",
  };
  return (
    <div key={Object.keys(ent).join("-")} data-qa-overlay="true" style={style}>
      <div style={{ display: "block", fontSize: box.labelSize, lineHeight: `${box.labelLine}px`, color: theme.color.textMuted, fontWeight: theme.font.weights.medium, ...textStyle(theme, "eyebrow") }}>{o.label}</div>
      <div style={{ display: "block", marginTop: box.gap, fontSize: box.valueSize, lineHeight: `${box.valueLine}px`, color: theme.color.text, fontWeight: theme.font.weights.stat }}>{o.value}</div>
    </div>
  );
}
