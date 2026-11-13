import React from "react";
import { Easing } from "../engine";
import { useTheme } from "../themes";
import { arrowPoints, circlePoints, pointsToArray, pointsToString, underlinePoints } from "./doodle";
import { kf } from "./kf";
import { themeEasing, useFrameOr } from "./util";

type Common = {
  frame?: number;
  /** Cuadro en que empieza a dibujarse. */
  start: number;
  /** Cuadro en que empieza a desvanecerse (10 cuadros). Por defecto nunca. */
  end?: number;
  /** Identificador/semilla único (también del degradado). */
  id: string;
  /** Cada cuántos cuadros se vuelve a sortear el temblor. Por defecto 3. */
  boil?: number;
  width?: number;
};

function useDoodle(frame: number | undefined, start: number, end: number, drawFrames: number) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const draw = kf(f, [start, start + drawFrames], [0, 1], themeEasing(theme.motion.easing.out));
  const fade = kf(f, [end, end + 10], [1, 0], Easing.linear);
  return { theme, f, draw, fade };
}

const safeId = (id: string) => `ve-doodle-${id.replace(/[^A-Za-z0-9_-]/g, "_")}-g`;

function bounds(pts: [number, number][]) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

function Svg({ id, fade, box, children }: { id: string; fade: number; box: ReturnType<typeof bounds>; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", opacity: fade, zIndex: 40 }} width={1} height={1}>
      <defs>
        {/* userSpaceOnUse: un trazo perfectamente recto (bbox sin alto) igual se pinta */}
        <linearGradient id={safeId(id)} gradientUnits="userSpaceOnUse" x1={box.x1} y1={box.y1} x2={box.x2} y2={box.y2}>
          <stop offset="0" stopColor={theme.color.accent} />
          <stop offset="1" stopColor={theme.color.accent2} />
        </linearGradient>
      </defs>
      {children}
    </svg>
  );
}

/** Trazo con avance normalizado (pathLength=1): el tramo dibujado no depende del largo del temblor de este cuadro. */
function Stroke({ id, pts, draw, width }: { id: string; pts: [number, number][]; draw: number; width: number }) {
  return (
    <polyline
      points={pointsToString(pts)}
      pathLength={1}
      fill="none"
      stroke={`url(#${safeId(id)})`}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="1 1"
      strokeDashoffset={1 - draw}
    />
  );
}

/** Elipse dibujada a mano que se traza y se desvanece; coordenadas del mundo. */
export function DoodleCircle({ cx, cy, rx, ry, frame, start, end = 99999, id, boil = 3, width = 5 }: Common & { cx: number; cy: number; rx: number; ry: number }) {
  const { f, draw, fade } = useDoodle(frame, start, end, 16);
  if (f < start || fade <= 0) return null;
  const pts = pointsToArray(circlePoints(id, f, cx, cy, rx, ry, boil));
  return (
    <Svg id={id} fade={fade} box={bounds(pts)}>
      <Stroke id={id} pts={pts} draw={draw} width={width} />
    </Svg>
  );
}

/** Flecha curva dibujada a mano de (x1, y1) a (x2, y2); la cabeza aparece al terminar el trazo. */
export function DoodleArrow({ x1, y1, x2, y2, bend = 0.25, frame, start, end = 99999, id, boil = 3, width = 6 }: Common & { x1: number; y1: number; x2: number; y2: number; bend?: number }) {
  const { theme, f, draw, fade } = useDoodle(frame, start, end, 20);
  if (f < start || fade <= 0) return null;
  const pts = arrowPoints(id, f, x1, y1, x2, y2, bend, boil);
  const shown = pts.slice(0, Math.max(2, Math.round(draw * pts.length)));
  const [ax, ay] = shown[shown.length - 1]!;
  const [bx, by] = shown[shown.length - 2]!;
  const ang = Math.atan2(ay - by, ax - bx);
  const head = (d: number): [number, number] => [ax - Math.cos(ang + d) * 22, ay - Math.sin(ang + d) * 22];
  return (
    <Svg id={id} fade={fade} box={bounds(pts)}>
      <polyline points={pointsToString(shown)} fill="none" stroke={`url(#${safeId(id)})`} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
      {draw > 0.95 && (
        <polyline points={pointsToString([head(0.5), [ax, ay], head(-0.5)])} fill="none" stroke={theme.color.accent2} strokeWidth={width - 1} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

/** Subrayado ondulado dibujado a mano de (x, y) hacia la derecha `length` px. */
export function DoodleUnderline({ x, y, length, frame, start, end = 99999, id, boil = 3, width = 5 }: Common & { x: number; y: number; length: number }) {
  const { f, draw, fade } = useDoodle(frame, start, end, 14);
  if (f < start || fade <= 0) return null;
  const pts = pointsToArray(underlinePoints(id, f, x, y, length, boil));
  return (
    <Svg id={id} fade={fade} box={bounds(pts)}>
      <Stroke id={id} pts={pts} draw={draw} width={width} />
    </Svg>
  );
}
