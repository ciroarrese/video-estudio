import { Easing } from "../engine";
import { useTheme } from "../themes";
import { kf } from "./kf";
import { useFrameOr } from "./util";

/**
 * Velo a cuadro completo que sube de 0 a 1 en `range`; se usa al final de las escenas.
 *
 * El velo es una transición, no contenido: mientras cruza, el texto de abajo se está tapando (un texto claro sobre acento
 * queda a 2:1 con el velo a medias). Por eso lleva `data-qa-veil="<opacidad>"` (0..1, 3 decimales): `qa` tiene que tratar el
 * texto de ese cuadro como un fundido (las reglas de contraste bajan a `info` mientras la opacidad del velo supera ~0.05).
 * `data-qa-ignore="covered"` evita que el propio velo se informe como una capa de cuadro completo.
 */
export function Wash({ frame, range, color }: { frame?: number; range: [number, number]; color?: string }) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const o = range[1] > range[0] ? kf(f, range, [0, 1], Easing.linear) : f >= range[0] ? 1 : 0;
  if (o <= 0) return null;
  // Opacidad solo mientras el velo cruza; ya cerrado (o = 1) no se emite, igual que en reposo.
  const op = o >= 1 ? undefined : +o.toFixed(4);
  return <div key={op === undefined ? "full" : "part"} data-qa-veil={o.toFixed(3)} data-qa-ignore="covered" style={{ position: "absolute", inset: 0, background: color ?? theme.color.bg, opacity: op, pointerEvents: "none", zIndex: 100 }} />;
}
