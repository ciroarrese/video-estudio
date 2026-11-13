import React from "react";
import { useTheme } from "../themes";
import { flight } from "./flight";
import { themeEasing, useFrameOr } from "./util";

/**
 * Elemento que viaja entre dos puntos con arco y estela que se desvanece.
 * `from`/`to` son el centro del elemento; los hijos se centran en esa posición.
 * Antes de `range[0]` está en `from` y después de `range[1]` en `to`.
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
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const easing = themeEasing(theme.motion.easing.inOut);
  const at = (fr: number) => flight(fr, range, from, to, { arc, easing });
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
    transform: `scale(${scale})`,
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
      <div style={{ ...place(cur, 1 + Math.sin(Math.PI * cur.t) * 0.06), zIndex: 30 }}>{children}</div>
    </>
  );
}
