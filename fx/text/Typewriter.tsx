import React from "react";
import { Easing } from "../../engine";
import { progress, roleColor, useFx } from "../core";
import type { ColorRole } from "../core";
import { baseText } from "./shared";
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
  return (
    <div style={{ ...baseText(theme, { ...props, fontSize: fs }), whiteSpace: "pre-wrap", display: "flex", alignItems: "center", gap: "0.5em", width: props.width, ...style }}>
      <span>
        <span>{chars.slice(0, count).join("")}</span>
        <span
          style={{
            display: "inline-block",
            width: "0.09em",
            height: "1em",
            marginLeft: "0.04em",
            marginRight: "-0.13em",
            verticalAlign: "text-bottom",
            background: roleColor(theme, caretColor),
            opacity: caretOn ? 1 : 0,
          }}
        />
        <span style={{ visibility: "hidden" }}>{chars.slice(count).join("")}</span>
      </span>
      {after !== undefined && (
        <span style={{ display: "inline-block", opacity: afterP > 0 ? 1 : 0, transform: `scale(${(0.5 + 0.5 * afterP).toFixed(4)})`, transformOrigin: "0% 50%" }}>
          {after}
        </span>
      )}
    </div>
  );
}
