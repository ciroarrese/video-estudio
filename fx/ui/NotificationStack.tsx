import { cornerRadius, entrance, staggerScale, surfaceStyle, textStyle, withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { chartColor, fade, fxBox, progress, styleKey, useFx } from "../core";
import type React from "react";
import type { FxProps } from "../core";
import { staggerT } from "../data/geom";

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

/** Paso vertical (px) entre tarjetas apiladas en una caja de alto `height` con `count` tarjetas: nunca más que alto + 18 y siempre dentro de la caja. */
export function notificationPitch(height: number, count: number): number {
  return Math.min(NOTIFICATION_CARD_HEIGHT + 18, (height - NOTIFICATION_CARD_HEIGHT - 10) / Math.max(1, count - 1));
}

/** Posicion vertical de la tarjeta `i`: cada tarjeta posterior que llega la empuja un paso hacia abajo. */
export function stackOffsets(arrivals: number[], pitch: number): number[] {
  return arrivals.map((_, i) => arrivals.slice(i + 1).reduce((s, a) => s + Math.min(1, a), 0) * pitch);
}

/** Notificaciones que llegan de a una y empujan a las anteriores hacia abajo. */
export function NotificationStack(p: NotificationStackProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, NOTIFICATION_SIZE);
  const items = p.items ?? DEFAULT;
  const n = items.length;
  const dur = p.duration ?? 70;
  const ch = NOTIFICATION_CARD_HEIGHT;
  const pitch = notificationPitch(h, n);
  // la primera llega arriba, las siguientes empujan: orden visual = la ultima llegada arriba
  // El paso entre tarjetas lo escala el diseño (`motion.stagger`); la entrada (subir 50 px) la decide `motion.entrance`.
  const spread = Math.min(0.95, 0.7 * staggerScale(theme));
  const arr = items.map((_, i) => Easing.out(staggerT(progress(local, 0, dur), i, n, spread)));
  const raw = items.map((_, i) => staggerT(progress(local, 0, dur), i, n, spread));
  const offs = stackOffsets(arr, pitch);
  const fs = theme.type.eyebrow;
  return (
    <div style={{ position: "relative", width: w, height: h, fontFamily: theme.font.family, ...p.style }}>
      {items.map((it, i) => {
        const a = arr[i]!;
        if (a <= 0) return null;
        // Traslado y opacidad solo mientras la tarjeta llega o es empujada (en reposo no queda `translateY(0.00px)`). La entrada sube 50 px
        // con el estilo por defecto; el diseño la reemplaza (`motion.entrance`) y le da rebote (`motion.overshoot`).
        const cardSt: React.CSSProperties = {
          position: "absolute", left: 0, top: 0, width: w, height: ch, boxSizing: "border-box", ...surfaceStyle(theme, "card"),
          display: "flex", alignItems: "center", gap: 20, padding: "0 26px", zIndex: i,
          ...entrance(theme, raw[i]!, i, { native: "rise", distance: -50, curve: Easing.lands, round: false, offset: { y: offs[i]! } }),
          opacity: fade(Math.min(1, a * 1.8)),
        };
        return (
          <div key={`${i}:${styleKey(cardSt)}`} style={cardSt}>
            <div style={{ width: 56, height: 56, flex: "none", borderRadius: cornerRadius(theme, "chip"), background: withAlpha(chartColor(theme, i), 0.18), color: theme.color.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs * 1.2, fontWeight: theme.font.weights.stat }}>{it.title.charAt(0)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: fs * 1.15, color: theme.color.text, ...textStyle(theme, "title") }}>{it.title}</span>
                <span style={{ fontSize: fs * 0.8, color: theme.color.textMuted, ...textStyle(theme, "eyebrow") }}>{it.time}</span>
              </div>
              {it.body && <div style={{ marginTop: 6, fontSize: fs * 0.9, color: theme.color.textMuted, maxHeight: fs * 1.3, overflow: "hidden" }}>{it.body}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
