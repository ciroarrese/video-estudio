import { Easing } from "../engine";
import { useTheme } from "../themes";
import { kf } from "./kf";
import { useFrameOr } from "./util";

/** Velo a cuadro completo que sube de 0 a 1 en `range`; se usa al final de las escenas. */
export function Wash({ frame, range, color }: { frame?: number; range: [number, number]; color?: string }) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const o = range[1] > range[0] ? kf(f, range, [0, 1], Easing.linear) : f >= range[0] ? 1 : 0;
  if (o <= 0) return null;
  return <div style={{ position: "absolute", inset: 0, background: color ?? theme.color.bg, opacity: o, pointerEvents: "none", zIndex: 100 }} />;
}
