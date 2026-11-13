import { Easing } from "../engine";
import { transitionVeil, useTheme } from "../themes";
import { kf } from "./kf";
import { useFrameOr } from "./util";

/**
 * Velo a cuadro completo que sube de 0 a 1 en `range`; se usa al final de las escenas.
 *
 * El velo es una transición, no contenido: mientras cruza, el texto de abajo se está tapando (un texto claro sobre acento
 * queda a 2:1 con el velo a medias). Por eso lleva `data-qa-veil="<opacidad>"` (0..1, 3 decimales): `qa` tiene que tratar el
 * texto de ese cuadro como un fundido (las reglas de contraste bajan a `info` mientras la opacidad del velo supera ~0.05).
 * `data-qa-ignore="covered"` evita que el propio velo se informe como una capa de cuadro completo.
 *
 * La forma del velo sale de `style.motion.transition` (`transitionVeil`): `wash` = fundido (el de siempre), `wipe` = cortina de izquierda a
 * derecha, `cut` = escalón al llegar al final, `through` = sin velo (la escena siguiente entra sobre el fondo que sigue; el final de la
 * escena tiene que atravesar un elemento, como el zoom de `zoomThrough`). `data-qa-veil` queda igual en todos los casos que dibujan algo.
 */
export function Wash({ frame, range, color }: { frame?: number; range: [number, number]; color?: string }) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const o = range[1] > range[0] ? kf(f, range, [0, 1], Easing.linear) : f >= range[0] ? 1 : 0;
  const veil = transitionVeil(theme, o, color);
  if (!veil) return null;
  // El velo cerrado del todo no lleva `opacity` ni `clipPath` (igual que en reposo); `key` cambia cuando cambia el conjunto de propiedades.
  const full = o >= 1;
  return <div key={`${veil.kind}-${full ? "full" : "part"}`} data-qa-veil={o.toFixed(3)} data-qa-ignore="covered" style={{ position: "absolute", inset: 0, ...veil.style, pointerEvents: "none", zIndex: 100 }} />;
}
