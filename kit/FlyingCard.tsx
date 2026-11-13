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
 */
export function FlyingCard({
  frame,
  range,
  from,
  to,
  arc = 0,
  width,
  height,
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
  const place = (p: { x: number; y: number }, scale = 1): React.CSSProperties => ({
    position: "absolute",
    left: p.x - width / 2,
    top: p.y - height / 2,
    width,
    height,
    // la escala solo se emite si no es 1 (en reposo no queda `scale(1)`)
    transform: +scale.toFixed(4) === 1 ? undefined : `scale(${+scale.toFixed(4)})`,
  });
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
