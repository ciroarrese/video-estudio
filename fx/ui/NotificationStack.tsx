import { cornerRadius, entrance, staggerScale, surfaceStyle, textStyle, withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { chartColor, fade, fxBox, fxDensity, progress, styleKey, useFx } from "../core";
import type React from "react";
import type { FxProps } from "../core";
import { staggerT } from "../data/geom";
import { fitText } from "../text/measure";

export type Notice = { title: string; body?: string; time?: string };
export type NotificationStackProps = FxProps & { items?: Notice[] };

const DEFAULT: Notice[] = [
  { title: "Pedido confirmado", body: "Se registró el pago de la orden 1042.", time: "ahora" },
  { title: "Nuevo comentario", body: "Alex dejó una nota en el borrador.", time: "2 min" },
  { title: "Recordatorio", body: "La reunión de equipo empieza en 10 minutos.", time: "9 min" },
  { title: "Actualización lista", body: "La versión 2.4 ya está disponible.", time: "1 h" },
];

/** Tamaño por defecto de la caja (px). */
export const NOTIFICATION_SIZE = { width: 760, height: 560 } as const;
/** Alto de cada tarjeta (px). */
export const NOTIFICATION_CARD_HEIGHT = 118;

/** Paso vertical (px) entre tarjetas apiladas en una caja de alto `height` con `count` tarjetas: nunca más que alto + 18 y siempre dentro de la caja. `scale` (la densidad del efecto) achica el alto de la tarjeta y los márgenes. */
export function notificationPitch(height: number, count: number, scale = 1): number {
  const ch = NOTIFICATION_CARD_HEIGHT * scale;
  return Math.min(ch + 18 * scale, (height - ch - 10 * scale) / Math.max(1, count - 1));
}

/** Posicion vertical de la tarjeta `i`: cada tarjeta posterior que llega la empuja un paso hacia abajo. */
export function stackOffsets(arrivals: number[], pitch: number): number[] {
  return arrivals.map((_, i) => arrivals.slice(i + 1).reduce((s, a) => s + Math.min(1, a), 0) * pitch);
}

/** Notificaciones que llegan de a una y empujan a las anteriores hacia abajo. */
export function NotificationStack(p: NotificationStackProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, NOTIFICATION_SIZE);
  // `density` (fx/core/density.ts): tarjeta, márgenes, ícono y letra bajan juntos en una caja chica; sin él, k = 1 (el de siempre)
  const items = p.items ?? DEFAULT;
  const n = items.length;
  // la caja de diseño tiene el alto justo para las tarjetas que hay (con dos, no hace falta el de cuatro)
  const k = fxDensity(p.density, { width: w, height: h }, { width: NOTIFICATION_SIZE.width, height: Math.min(NOTIFICATION_SIZE.height, NOTIFICATION_CARD_HEIGHT + (n - 1) * (NOTIFICATION_CARD_HEIGHT + 18) + 10) });
  const dur = p.duration ?? 70;
  const ch = NOTIFICATION_CARD_HEIGHT * k;
  const pitch = notificationPitch(h, n, k);
  // la primera llega arriba, las siguientes empujan: orden visual = la ultima llegada arriba
  // El paso entre tarjetas lo escala el diseño (`motion.stagger`); la entrada (subir 50 px) la decide `motion.entrance`.
  const spread = Math.min(0.95, 0.7 * staggerScale(theme));
  const arr = items.map((_, i) => Easing.out(staggerT(progress(local, 0, dur), i, n, spread)));
  const raw = items.map((_, i) => staggerT(progress(local, 0, dur), i, n, spread));
  const offs = stackOffsets(arr, pitch);
  const fs = theme.type.eyebrow * k;
  const padX = 26 * k, icon = 56 * k, gap = 20 * k;
  return (
    <div style={{ position: "relative", width: w, height: h, fontFamily: theme.font.family, ...p.style }}>
      {items.map((it, i) => {
        const a = arr[i]!;
        if (a <= 0) return null;
        // Traslado y opacidad solo mientras la tarjeta llega o es empujada (en reposo no queda `translateY(0.00px)`). La entrada sube 50 px
        // con el estilo por defecto; el diseño la reemplaza (`motion.entrance`) y le da rebote (`motion.overshoot`).
        const cardSt: React.CSSProperties = {
          position: "absolute", left: 0, top: 0, width: w, minHeight: ch, boxSizing: "border-box", ...surfaceStyle(theme, "card"),
          display: "flex", alignItems: "center", gap, padding: `0 ${padX}px`, zIndex: i,
          ...entrance(theme, raw[i]!, i, { native: "rise", distance: -50 * k, curve: Easing.lands, round: false, offset: { y: offs[i]! } }),
          opacity: fade(Math.min(1, a * 1.8)),
        };
        // Cuerpo en una sola línea: la letra baja (hasta un 20 %) si hace falta para que entre en el ancho que deja la tarjeta, medido con la
        // tipografía del tema. Si aun así no entra (otra fuente, letra más grande), el texto pasa a otra línea y la tarjeta crece en vez de
        // recortarlo con `overflow: hidden`.
        const bodyFs = it.body ? fitText(it.body, w - 2 * padX - icon - gap, { font: { family: theme.font.family, weight: theme.font.weights.regular }, max: fs * 0.9, min: fs * 0.9 * 0.8 }) : fs * 0.9;
        return (
          <div key={`${i}:${styleKey(cardSt)}`} style={cardSt}>
            <div style={{ width: icon, height: icon, flex: "none", borderRadius: cornerRadius(theme, "chip"), background: withAlpha(chartColor(theme, i), 0.18), color: theme.color.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs * 1.2, fontWeight: theme.font.weights.stat }}>{it.title.charAt(0)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 * k }}>
                <span style={{ fontSize: fs * 1.15, color: theme.color.text, ...textStyle(theme, "title") }}>{it.title}</span>
                <span style={{ fontSize: fs * 0.8, color: theme.color.textMuted, ...textStyle(theme, "eyebrow") }}>{it.time}</span>
              </div>
              {it.body && <div style={{ marginTop: 6 * k, fontSize: bodyFs, color: theme.color.textMuted }}>{it.body}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
