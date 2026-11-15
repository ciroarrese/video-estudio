import React from "react";
import { useTheme } from "../themes";
import { flight } from "./flight";
import { themeEasing, useFrameOr } from "./util";

/**
 * Elemento que viaja entre dos puntos con arco y estela que se desvanece.
 * `from`/`to` son el centro del elemento; los hijos se centran en esa posición.
 * Antes de `range[0]` no se dibuja (`hideBefore`, por defecto true: si no, quedaba una copia encima del origen mientras la tarjeta
 * "real" todavía estaba ahí); después de `range[1]` queda en `to` (`hideAfter: true` la oculta). Con `hideBefore={false}` se
 * dibuja en `from` desde el principio.
 *
 * Opcionales, para que la tarjeta cambie mientras vuela: `toWidth`/`toHeight` (el tamaño al llegar; crece o se achica con la misma curva del vuelo, para que
 * una tarjeta chica del origen llegue a ser el panel grande del destino) y `rotate` (grados: un número fijo, o `[desde, hasta]` para que gire mientras
 * viaja). Sin ellos la pieza es la de siempre, con el mismo marcado. Un tamaño que cambia relayoutea los hijos en cada cuadro (es una función pura del cuadro:
 * no deja estado), pero un texto bajo `rotate()` o bajo una escala fraccionaria es el riesgo conocido de `docs/reglas.md`: si `--check` falla, girá una
 * tarjeta sin texto (el texto entra con un fundido al llegar) o animá el tamaño en vez de la escala.
 */
export function FlyingCard({
  frame,
  range,
  from,
  to,
  arc = 0,
  width,
  height,
  toWidth,
  toHeight,
  rotate,
  trail = 5,
  trailLag = 1.5,
  hideBefore = true,
  hideAfter = false,
  children,
}: {
  frame?: number;
  range: [number, number];
  from: { x: number; y: number };
  to: { x: number; y: number };
  arc?: number;
  width: number;
  height: number;
  /** Ancho al llegar a `to` (por defecto `width`: no cambia). */
  toWidth?: number;
  /** Alto al llegar a `to` (por defecto `height`: no cambia). */
  toHeight?: number;
  /** Rotación en grados: fija, o `[al salir, al llegar]` (con la curva del vuelo). Por defecto 0. */
  rotate?: number | [number, number];
  trail?: number;
  trailLag?: number;
  /** No dibujar nada antes de `range[0]` (por defecto true). */
  hideBefore?: boolean;
  /** No dibujar nada desde después de `range[1]` (por defecto false: queda en `to`). */
  hideAfter?: boolean;
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const easing = themeEasing(theme.motion.easing.inOut);
  const at = (fr: number) => flight(fr, range, from, to, { arc, easing });
  if ((hideBefore && f < range[0]) || (hideAfter && f > range[1])) return null;
  const cur = at(f);
  const moving = cur.t > 0 && cur.t < 1;
  // la estela entra y sale suavemente: sin fantasmas de un solo cuadro en los extremos
  const trailFade = Math.min(1, cur.t / 0.12, (1 - cur.t) / 0.12);
  const rot = (t: number) => (rotate === undefined ? 0 : typeof rotate === "number" ? rotate : rotate[0] + (rotate[1] - rotate[0]) * t);
  const place = (p: { x: number; y: number; t: number }, scale = 1): React.CSSProperties => {
    const w = toWidth === undefined ? width : +(width + (toWidth - width) * p.t).toFixed(2);
    const h = toHeight === undefined ? height : +(height + (toHeight - height) * p.t).toFixed(2);
    const s = +scale.toFixed(4), a = +rot(p.t).toFixed(3);
    // escala y giro solo se emiten si no son la identidad (en reposo no queda `scale(1)` ni `rotate(0deg)`)
    const parts = [a !== 0 ? `rotate(${a}deg)` : "", s !== 1 ? `scale(${s})` : ""].filter(Boolean).join(" ");
    return { position: "absolute", left: p.x - w / 2, top: p.y - h / 2, width: w, height: h, transform: parts || undefined };
  };
  return (
    <>
      {moving &&
        Array.from({ length: trail }, (_, i) => {
          const n = trail - i; // el más antiguo primero (queda debajo)
          const p = at(f - n * trailLag);
          return (
            <div key={n} style={{ ...place(p, 1 - n * 0.04), opacity: (1 - n / (trail + 1)) * 0.35 * trailFade, pointerEvents: "none" }}>
              {children}
            </div>
          );
        })}
      <div key={+(1 + Math.sin(Math.PI * cur.t) * 0.06).toFixed(4) === 1 ? "rest" : "fly"} style={{ ...place(cur, 1 + Math.sin(Math.PI * cur.t) * 0.06), zIndex: 30 }}>{children}</div>
    </>
  );
}
