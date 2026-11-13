import type React from "react";
import { Easing } from "../../engine";
import { fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";

export type PhoneFrameProps = FxProps & { children?: React.ReactNode; bezel?: number };

/** Caja (px, relativa al marco) de la pantalla de un telefono. */
export function phoneScreen(width: number, height: number, bezel = 14): { x: number; y: number; width: number; height: number } {
  return { x: bezel, y: bezel, width: width - bezel * 2, height: height - bezel * 2 };
}

/** Marco de telefono: la pantalla recorta a sus hijos con el radio de las esquinas. */
export function PhoneFrame(p: PhoneFrameProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 380, height: 760 });
  const bez = p.bezel ?? 14;
  const scr = phoneScreen(w, h, bez);
  const R = theme.radius.lg * 2.2;
  const k = Easing.out(progress(local, 0, p.duration ? Math.min(20, p.duration * 0.3) : 20));
  return (
    <div style={{ position: "relative", width: w, height: h, transform: `translateY(${((1 - k) * 36).toFixed(2)}px)`, opacity: k, fontFamily: theme.font.family, color: theme.color.text, ...p.style }}>
      <div style={{ position: "absolute", inset: 0, background: theme.color.text, clipPath: `inset(0 round ${R + bez}px)` }} />
      <div style={{ position: "absolute", left: scr.x, top: scr.y, width: scr.width, height: scr.height, overflow: "hidden", background: theme.color.bg, clipPath: `inset(0 round ${R}px)` }}>
        {p.children}
      </div>
      <div style={{ position: "absolute", left: w / 2 - 54, top: bez + 12, width: 108, height: 30, background: theme.color.text, clipPath: `inset(0 round ${theme.radius.pill}px)` }} />
    </div>
  );
}
