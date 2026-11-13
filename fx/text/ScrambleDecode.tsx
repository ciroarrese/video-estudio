import { random } from "../../engine";
import { Easing, clamp, progress, roleColor, useFx } from "../core";
import { textLook } from "../../themes";
import { decoration, decorationHost, frontCaretStyle, hasFrontCaret } from "./look";
import { baseText, titleTreatment } from "./shared";
import type { TextFxProps } from "./shared";
import { measureWidth } from "./measure";

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
  const tt = titleTreatment(theme, props.weight);
  const font = { family: theme.font.family, weight: tt.weight, letterSpacing: tt.tracking };
  return (
    <div style={{ ...baseText(theme, props, true), display: "flex", ...(deco ? { width: "fit-content", ...decorationHost(theme) } : {}), ...style }}>
      {finals.map((ch, i) => {
        const w = ch === " " ? measureWidth(" ", fs, font) : measureWidth(ch, fs, font);
        const resolved = shown[i] === ch;
        return (
          <span key={`${i}${resolved ? "r" : "s"}${i === front ? "c" : ""}`} data-qa-ignore={resolved ? undefined : "overlap"} style={{ display: "inline-block", width: w, textAlign: "center", opacity: resolved || i === front ? 1 : 0.75, ...(i === front ? frontCaretStyle(theme, roleColor(theme, "accent")) : {}) }}>
            {shown[i] === " " ? " " : shown[i]}
          </span>
        );
      })}
      {decoration(theme, progress(local, duration - 8, 12, Easing.out), fs, roleColor(theme, "accent"))}
    </div>
  );
}
