import { Easing } from "../engine";
import type { EasingFn } from "../engine";
import { kf } from "./kf";

export type FlightOptions = {
  /** Desvío máximo (px) perpendicular a la recta; signo = lado. Por defecto 0. */
  arc?: number;
  easing?: EasingFn;
};

/** Posición de algo que viaja de `from` a `to` entre `start` y `end`, con arco; `t` es el progreso con easing (0..1). */
export function flight(
  frame: number,
  [start, end]: [number, number],
  from: { x: number; y: number },
  to: { x: number; y: number },
  { arc = 0, easing = Easing.inOut }: FlightOptions = {},
): { x: number; y: number; t: number } {
  const t = end > start ? kf(frame, [start, end], [0, 1], easing) : frame >= start ? 1 : 0;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bump = Math.sin(Math.PI * t) * arc;
  return { x: from.x + dx * t + (-dy / len) * bump, y: from.y + dy * t + (dx / len) * bump, t };
}
