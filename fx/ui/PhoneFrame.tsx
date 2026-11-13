import type React from "react";
import { Easing } from "../../engine";
import { fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";
import { contrastRatio, relativeLuminance } from "../../themes";

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
  // El marco del aparato es siempre el más oscuro de texto/fondo (con tema oscuro, el texto es claro y daría un marco blanco).
  const body = relativeLuminance(theme.color.text) <= relativeLuminance(theme.color.bg) ? theme.color.text : theme.color.bg;
  const ring = contrastRatio(body, theme.color.bg) < 1.5; // marco igual al fondo: se lo recorta con un borde del tema
  const k = Easing.out(progress(local, 0, p.duration ? Math.min(20, p.duration * 0.3) : 20));
  return (
    <div style={{ position: "relative", width: w, height: h, transform: `translateY(${((1 - k) * 36).toFixed(2)}px)`, opacity: k, fontFamily: theme.font.family, color: theme.color.text, ...p.style }}>
      {ring && <div style={{ position: "absolute", inset: -2, background: theme.color.border, clipPath: `inset(0 round ${R + bez + 2}px)` }} />}
      <div style={{ position: "absolute", inset: 0, background: body, clipPath: `inset(0 round ${R + bez}px)` }} />
      <div style={{ position: "absolute", left: scr.x, top: scr.y, width: scr.width, height: scr.height, overflow: "hidden", background: theme.color.bg, clipPath: `inset(0 round ${R}px)` }}>
        {p.children}
      </div>
      <div style={{ position: "absolute", left: w / 2 - 54, top: bez + 12, width: 108, height: 30, background: body, clipPath: `inset(0 round ${theme.radius.pill}px)` }} />
    </div>
  );
}
