import React from "react";
import { useTheme } from "../themes";
import { kf } from "./kf";
import { themeEasing, useFrameOr } from "./util";

const defaultFormat = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Número que cuenta de `from` a `to` durante `duration` cuadros desde `start`; `format` por defecto redondea con separador de miles. */
export function CountUp({
  from = 0,
  to,
  frame,
  start,
  duration,
  format = defaultFormat,
  style,
}: {
  from?: number;
  to: number;
  frame?: number;
  start: number;
  duration: number;
  format?: (n: number) => string;
  style?: React.CSSProperties;
}) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const v = duration > 0 ? kf(f, [start, start + duration], [from, to], themeEasing(theme.motion.easing.out)) : f >= start ? to : from;
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{format(v)}</span>;
}
