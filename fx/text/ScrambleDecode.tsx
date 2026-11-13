import { random } from "../../engine";
import { clamp, progress, useFx } from "../core";
import { baseText } from "./shared";
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
  const shown = Array.from(scrambleAt(text, local, duration, seed, glyphs, hold));
  const finals = Array.from(text);
  const font = { family: theme.font.family, weight: props.weight ?? theme.font.weights.semibold };
  return (
    <div style={{ ...baseText(theme, props), display: "flex", ...style }}>
      {finals.map((ch, i) => {
        const w = ch === " " ? measureWidth(" ", fs, font) : measureWidth(ch, fs, font);
        const resolved = shown[i] === ch;
        return (
          <span key={`${i}${resolved ? "r" : "s"}`} data-qa-ignore={resolved ? undefined : "overlap"} style={{ display: "inline-block", width: w, textAlign: "center", opacity: resolved ? 1 : 0.75 }}>
            {shown[i] === " " ? " " : shown[i]}
          </span>
        );
      })}
    </div>
  );
}
