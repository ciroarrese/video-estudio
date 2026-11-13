import React from "react";
import { fade, mix, styleKey, xform } from "../core";
import { textLook } from "../../themes";
import type { Theme } from "../../themes";

/*
 * Ayudas compartidas de los efectos de texto para `style.text` (y `style.line.glow`): llegada, cursor, adorno bajo el texto.
 * Los efectos piden acá lo que necesitan y no comparan cadenas del estilo. Todo es función pura del progreso `p` (0 a 1);
 * en reposo (`p >= 1`) no se emite `transform`, `opacity` ni `font-size` identidad.
 */

const px = (n: number) => `${+n.toFixed(2)}px`;

/**
 * Estilo del tramo interior de una letra (o palabra) de `MaskedRise` mientras llega, dentro de su máscara. `rise` (por defecto): sube con
 * un asentado de tamaño 108 % a 100 %; `fade`: aparece en su lugar; `slide`: entra de costado; `scale`: crece desde el pie.
 */
export function arrivalInner(theme: Theme, p: number, fs: number): React.CSSProperties {
  if (p >= 1) return { display: "block" };
  const a = textLook(theme).arrival;
  switch (a) {
    case "fade":
      return { display: "block", opacity: fade(p) };
    case "slide":
      return { display: "block", opacity: fade(Math.min(1, p * 1.6)), transform: xform({ x: -(1 - p) * fs * 0.7, round: true }) };
    case "scale":
      return { display: "block", fontSize: px(fs * (0.35 + 0.65 * p)), opacity: fade(Math.min(1, p * 1.5)), transformOrigin: "0% 100%" };
    default:
      return { display: "block", fontSize: `${(fs * (1 + 0.08 * (1 - p))).toFixed(1)}px`, transform: xform({ y: (1 - p) * fs * 1.36, round: true }), transformOrigin: "0% 100%" };
  }
}

/**
 * Llegada de un elemento suelto que aterriza al terminar (el extra de `Typewriter`, el sufijo de `DigitRoll`), `p` de 0 a 1.
 * `rise` (por defecto) = lo de siempre: sin opacidad ni traslado en reposo, aparece de golpe y sube; `grow` agrega el crecimiento de
 * tamaño de letra del sufijo (solo con `rise` y `scale`).
 */
export function landStyle(theme: Theme, p: number, fs: number, grow = false): React.CSSProperties {
  const a = textLook(theme).arrival;
  const size = (k: number): React.CSSProperties => (grow && p < 1 ? { fontSize: px(fs * k) } : {});
  switch (a) {
    case "fade":
      return { opacity: p > 0 ? fade(p) : 0 };
    case "slide":
      return { opacity: p > 0 ? undefined : 0, transform: xform({ x: -(1 - p) * fs * 0.8, round: true }) };
    case "scale":
      return { opacity: p > 0 ? undefined : 0, transform: xform({ scale: 0.3 + 0.7 * p }), ...size(1) };
    default:
      return { opacity: p > 0 ? undefined : 0, ...(grow && p < 1 ? { fontSize: `${(fs * (0.6 + 0.4 * p)).toFixed(1)}px` } : {}), transform: xform({ y: (1 - p) * fs * 0.5, round: true }) };
  }
}

/** Atributos de `key` para un estilo que agrega y quita propiedades (ver `styleKey`). */
export const keyOf = styleKey;

/**
 * Cursor de escritura: `bar` (barra fina, como siempre), `block` (bloque del ancho de una letra) o `underscore` (guion bajo). Devuelve el
 * estilo del elemento `inline-block` (ya con el halo de `line.glow`). `color` es el color CSS del cursor.
 */
export function caretStyle(theme: Theme, color: string, on: boolean): React.CSSProperties {
  const L = textLook(theme);
  const shape: React.CSSProperties =
    L.caret === "block"
      ? { width: "0.52em", height: "1em", marginLeft: "0.04em", marginRight: "-0.56em", verticalAlign: "text-bottom" }
      : L.caret === "underscore"
        ? { width: "0.52em", height: "0.09em", marginLeft: "0.04em", marginRight: "-0.56em", verticalAlign: "-0.1em" }
        : { width: "0.09em", height: "1em", marginLeft: "0.04em", marginRight: "-0.13em", verticalAlign: "text-bottom" };
  return {
    display: "inline-block",
    ...shape,
    background: color,
    ...(L.glow > 0 ? { boxShadow: `0 0 ${(0.45 * L.glow).toFixed(2)}em ${mix(color, theme.color.bg, 0.3)}` } : {}),
    opacity: on ? 1 : 0,
  };
}

/** `true` si el cursor del tema es de bloque o guion bajo (lo usa `ScrambleDecode` para marcar el frente de la resolución). */
export const hasFrontCaret = (theme: Theme): boolean => textLook(theme).caret !== "bar";

/** Estilo del glifo que lleva el cursor de `ScrambleDecode` (el primero sin resolver). */
export function frontCaretStyle(theme: Theme, color: string): React.CSSProperties {
  const c = textLook(theme).caret;
  return c === "block" ? { background: color, color: theme.color.onAccent } : c === "underscore" ? { boxShadow: `inset 0 -0.09em 0 ${color}` } : {};
}

/**
 * Adorno bajo el texto de un elemento `position: relative; isolation: isolate`: `underline` (se dibuja de izquierda a derecha), `marker`
 * (barrido de marcador detrás) o `box` (recuadro de acento), con `p` de 0 a 1. `null` sin adorno o con `p <= 0`. En reposo emite solo
 * el ancho completo. `color` es el color CSS del adorno.
 */
export function decoration(theme: Theme, p: number, fs: number, color: string): React.ReactNode {
  const L = textLook(theme);
  if (L.decoration === "none" || p <= 0) return null;
  const w = p >= 1 ? "100%" : `${+(p * 100).toFixed(2)}%`;
  const glow = L.glow > 0 ? { boxShadow: `0 0 ${(0.4 * L.glow).toFixed(2)}em ${mix(color, theme.color.bg, 0.3)}` } : {};
  const base: React.CSSProperties = { position: "absolute", pointerEvents: "none" };
  let st: React.CSSProperties;
  if (L.decoration === "underline") st = { ...base, left: 0, bottom: "-0.08em", height: px(Math.max(2, fs * 0.04)), width: w, background: color, ...glow };
  else if (L.decoration === "marker") st = { ...base, left: "-0.06em", top: "52%", bottom: "4%", width: p >= 1 ? "calc(100% + 0.12em)" : `calc(${w} + ${+(0.12 * p).toFixed(3)}em)`, background: mix(color, theme.color.bg, 0.72), zIndex: -1 };
  else st = { ...base, left: "-0.18em", top: "-0.04em", height: "calc(100% + 0.08em)", width: p >= 1 ? "calc(100% + 0.36em)" : `calc(${w} + ${+(0.36 * p).toFixed(3)}em)`, boxSizing: "border-box", border: `${px(Math.max(2, fs * 0.03))} solid ${color}`, overflow: "hidden", ...glow };
  return <span key={styleKey(st)} aria-hidden="true" data-qa-decor="" data-qa-ignore="overlap covered" style={st} />;
}

/** Estilo que pide el contenedor de un adorno (para el texto sobre el que se dibuja). Vacío sin adorno: el HTML por defecto no cambia. */
export function decorationHost(theme: Theme): React.CSSProperties {
  return textLook(theme).decoration === "none" ? {} : { position: "relative", isolation: "isolate" };
}
