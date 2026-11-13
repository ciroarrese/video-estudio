import type React from "react";
import { Easing } from "../../engine";
import { fade, fxBox, progress, styleKey, useFx, xform } from "../core";
import type { FxProps } from "../core";
import { contrastRatio, relativeLuminance } from "../../themes";

export type PhoneFrameProps = FxProps & { children?: React.ReactNode; bezel?: number };

/** Tamaño por defecto del marco (px). */
export const PHONE_SIZE = { width: 380, height: 760 } as const;
/** Grosor por defecto del borde del marco (px): la pantalla queda a esta distancia de cada lado. */
export const PHONE_BEZEL = 14;

/**
 * Caja (px, relativa al marco) de la pantalla de un telefono: `{ x, y, width, height }`. Es el tamaño en el que hay que armar
 * la interfaz que va de `children` (por ejemplo `phoneScreen(300, 600).width` = 272). Sin argumentos, el del marco por defecto.
 */
export function phoneScreen(width: number = PHONE_SIZE.width, height: number = PHONE_SIZE.height, bezel: number = PHONE_BEZEL): { x: number; y: number; width: number; height: number } {
  return { x: bezel, y: bezel, width: width - bezel * 2, height: height - bezel * 2 };
}

/** Radio (px) de las esquinas de la pantalla; el marco tiene `phoneScreenRadius(theme) + bezel`. */
export function phoneScreenRadius(theme: { radius: { lg: number } }): number {
  return theme.radius.lg * 2.2;
}

/** Marco de telefono: la pantalla recorta a sus hijos con el radio de las esquinas. */
export function PhoneFrame(p: PhoneFrameProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, PHONE_SIZE);
  const bez = p.bezel ?? PHONE_BEZEL;
  const scr = phoneScreen(w, h, bez);
  const R = phoneScreenRadius(theme);
  // El marco del aparato es siempre el más oscuro de texto/fondo (con tema oscuro, el texto es claro y daría un marco blanco).
  const body = relativeLuminance(theme.color.text) <= relativeLuminance(theme.color.bg) ? theme.color.text : theme.color.bg;
  const ring = contrastRatio(body, theme.color.bg) < 1.5; // marco igual al fondo: se lo recorta con un borde del tema
  const k = Easing.out(progress(local, 0, p.duration ? Math.min(20, p.duration * 0.3) : 20));
  // Traslado y opacidad solo mientras el marco entra (en reposo no queda `translateY(0.00px)` ni `opacity: 0.99`).
  const rootSt: React.CSSProperties = { position: "relative", width: w, height: h, transform: xform({ y: (1 - k) * 36 }), opacity: fade(k), fontFamily: theme.font.family, color: theme.color.text, ...p.style };
  return (
    <div key={styleKey(rootSt)} style={rootSt}>
      {ring && <div style={{ position: "absolute", inset: -2, background: theme.color.border, clipPath: `inset(0 round ${R + bez + 2}px)` }} />}
      <div style={{ position: "absolute", inset: 0, background: body, clipPath: `inset(0 round ${R + bez}px)` }} />
      <div style={{ position: "absolute", left: scr.x, top: scr.y, width: scr.width, height: scr.height, overflow: "hidden", background: theme.color.bg, clipPath: `inset(0 round ${R}px)` }}>
        {p.children}
      </div>
      <div style={{ position: "absolute", left: w / 2 - 54, top: bez + 12, width: 108, height: 30, background: body, clipPath: `inset(0 round ${theme.radius.pill}px)` }} />
    </div>
  );
}
