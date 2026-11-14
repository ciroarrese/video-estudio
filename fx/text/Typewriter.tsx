import React from "react";
import { Easing, useVideoConfig } from "../../engine";
import { progress, roleColor, styleKey, useFx } from "../core";
import type { ColorRole } from "../core";
import { baseText } from "./shared";
import { caretStyle, decoration, decorationHost, landStyle } from "./look";
import type { TextFxProps } from "./shared";

export type TypewriterProps = TextFxProps & {
  caretColor?: ColorRole;
  /** Elemento que aparece de golpe al terminar de escribir (por ejemplo, una etiqueta). */
  after?: React.ReactNode;
};

/** Escribe `text` con un cursor que parpadea; al terminar, el cursor se apaga y `after` aparece con un rebote. */
export function Typewriter(props: TypewriterProps) {
  const { text, caretColor = "accent", after, style } = props;
  const { local, theme } = useFx(props);
  const { width: frameW } = useVideoConfig();
  const chars = Array.from(text);
  const n = chars.length;
  const duration = props.duration ?? Math.max(12, Math.round(n * 2));
  const typedP = progress(local, 0, duration);
  const count = Math.min(n, Math.floor(typedP * n + 1e-9));
  const done = local >= duration;
  const fs = props.fontSize ?? theme.type.h2;
  const blink = Math.floor(local / 8) % 2 === 0;
  const caretOn = !done && (typedP < 1 ? (count > 0 && count < n ? true : blink) : false);
  const afterP = progress(local, duration + 2, 14, Easing.lands);
  // El extra solo lleva opacidad y traslado mientras aparece.
  const afterStyle: React.CSSProperties = { display: "inline-block", ...landStyle(theme, afterP, fs) };
  return (
    <div style={{ ...baseText(theme, { ...props, fontSize: fs }, true), whiteSpace: "pre-wrap", display: "flex", alignItems: "center", gap: "0.5em", width: props.width, minWidth: 0, maxWidth: frameW - 2 * theme.safe.x, ...style }}>
      {/* `minWidth: 0` deja que el texto baje de renglón en vez de salirse del área segura con una tipografía más ancha o más grande */}
      <span style={{ minWidth: 0, ...decorationHost(theme) }}>
        <span>{chars.slice(0, count).join("")}</span>
        <span style={caretStyle(theme, roleColor(theme, caretColor), caretOn)} />
        <span style={{ visibility: "hidden" }}>{chars.slice(count).join("")}</span>
        {decoration(theme, progress(local, duration - 6, 14, Easing.out), fs, roleColor(theme, "accent"))}
      </span>
      {after !== undefined && (
        <span key={styleKey(afterStyle)} style={afterStyle}>
          {after}
        </span>
      )}
    </div>
  );
}
