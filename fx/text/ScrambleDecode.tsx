import { random } from "../../engine";
import { Easing, clamp, progress, roleColor, useFx } from "../core";
import { textLook } from "../../themes";
import { decoration, decorationHost, frontCaretStyle, hasFrontCaret } from "./look";
import { baseText } from "./shared";
import type { TextFxProps } from "./shared";

export type ScrambleDecodeProps = TextFxProps & {
  /** Alfabeto de los glifos al azar. */
  glyphs?: string;
  /** Cuadros que dura cada glifo al azar antes de cambiar. */
  hold?: number;
};

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?";

/** Texto final en cada posicion para el cuadro dado (funcion pura; sirve para pruebas). */
export function scrambleAt(text: string, local: number, duration: number, seed: string | number, glyphs = GLYPHS, hold = 2): string {
  const chars = Array.from(text);
  const n = chars.length;
  const p = progress(local, 0, duration);
  return chars
    .map((ch, i) => {
      if (ch === " ") return " ";
      // Cada letra se resuelve de izquierda a derecha, con un pequeno desorden sembrado.
      const resolveAt = clamp((i / Math.max(1, n)) * 0.75 + random(`${seed}:r:${i}`) * 0.25, 0, 0.98);
      if (p >= resolveAt || local >= duration) return ch;
      const g = Array.from(glyphs);
      return g[Math.floor(random(`${seed}:g:${i}:${Math.floor(local / hold)}`) * g.length)]!;
    })
    .join("");
}

/** Glifos al azar que se resuelven de izquierda a derecha hasta el texto final. Cada letra ocupa una ranura de ancho fijo: sin saltos de maquetacion. */
export function ScrambleDecode(props: ScrambleDecodeProps) {
  const { text, glyphs, hold, seed = "scramble", style } = props;
  const { local, theme } = useFx(props);
  const fs = props.fontSize ?? theme.type.h2;
  const duration = props.duration ?? Math.max(20, Array.from(text).length * 3);
  const alphabet = glyphs ?? textLook(theme).glyphs;
  const shown = Array.from(scrambleAt(text, local, duration, seed, alphabet, hold));
  const finals = Array.from(text);
  const deco = textLook(theme).decoration !== "none";
  // Cursor de bloque o guion bajo en el primer glifo sin resolver (con la barra, que es lo de siempre, no hay cursor acá).
  const front = hasFrontCaret(theme) ? shown.findIndex((c, i) => c !== finals[i]) : -1;
  return (
    <div style={{ ...baseText(theme, props, true), display: "flex", ...(deco ? { width: "fit-content", ...decorationHost(theme) } : {}), ...style }}>
      {finals.map((ch, i) => {
        const resolved = shown[i] === ch;
        const caret = i === front;
        // Cada ranura mide lo que mide su letra final, con la tipografía que de verdad se dibuja (no con un ancho medido aparte): el texto
        // no salta al resolverse y una fuente más ancha no hace que las letras se pisen. La letra resuelta va en el flujo; el glifo al azar
        // se centra encima de una copia invisible de la final (`visibility: hidden`: sin texto para `qa`).
        if (resolved) {
          return (
            <span key={`${i}r${caret ? "c" : ""}`} style={{ display: "inline-block", whiteSpace: "pre", textAlign: "center", opacity: 1, ...(caret ? frontCaretStyle(theme, roleColor(theme, "accent")) : {}) }}>
              {ch}
            </span>
          );
        }
        return (
          <span key={`${i}s${caret ? "c" : ""}`} style={{ display: "inline-block", position: "relative", whiteSpace: "pre", textAlign: "center", opacity: caret ? 1 : 0.75, ...(caret ? frontCaretStyle(theme, roleColor(theme, "accent")) : {}) }}>
            <span aria-hidden="true" style={{ visibility: "hidden" }}>{ch}</span>
            {/* glifo al azar: relleno que dura 2 cuadros y se pisa con los vecinos a propósito (`overlap`); la letra final, ya resuelta, se juzga entera */}
            <span aria-hidden="true" data-qa-ignore="overlap" style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", whiteSpace: "pre" }}>{shown[i] === " " ? " " : shown[i]}</span>
          </span>
        );
      })}
      {decoration(theme, progress(local, duration - 8, 12, Easing.out), fs, roleColor(theme, "accent"))}
    </div>
  );
}
