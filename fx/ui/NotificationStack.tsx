import { withAlpha } from "../../themes";
import { Easing } from "../../engine";
import { chartColor, fxBox, progress, useFx } from "../core";
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

/** Posicion vertical de la tarjeta `i`: cada tarjeta posterior que llega la empuja un paso hacia abajo. */
export function stackOffsets(arrivals: number[], pitch: number): number[] {
  return arrivals.map((_, i) => arrivals.slice(i + 1).reduce((s, a) => s + Math.min(1, a), 0) * pitch);
}

/** Notificaciones que llegan de a una y empujan a las anteriores hacia abajo. */
export function NotificationStack(p: NotificationStackProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 760, height: 560 });
  const items = p.items ?? DEFAULT;
  const n = items.length;
  const dur = p.duration ?? 70;
  const ch = 118;
  const pitch = Math.min(ch + 18, (h - ch - 10) / Math.max(1, n - 1));
  // la primera llega arriba, las siguientes empujan: orden visual = la ultima llegada arriba
  const arr = items.map((_, i) => Easing.out(staggerT(progress(local, 0, dur), i, n, 0.7)));
  const land = items.map((_, i) => Easing.lands(staggerT(progress(local, 0, dur), i, n, 0.7)));
  const offs = stackOffsets(arr, pitch);
  const fs = theme.type.eyebrow;
  return (
    <div style={{ position: "relative", width: w, height: h, fontFamily: theme.font.family, ...p.style }}>
      {items.map((it, i) => {
        const a = arr[i]!;
        if (a <= 0) return null;
        const y = offs[i]! + (1 - land[i]!) * -50;
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, width: w, height: ch, boxSizing: "border-box", transform: `translateY(${y.toFixed(2)}px)`, opacity: Math.min(1, a * 1.8), background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg, boxShadow: theme.shadow.md, display: "flex", alignItems: "center", gap: 20, padding: "0 26px", zIndex: i }}>
            <div style={{ width: 56, height: 56, flex: "none", borderRadius: theme.radius.pill, background: withAlpha(chartColor(theme, i), 0.18), color: chartColor(theme, i), display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs * 1.2, fontWeight: theme.font.weights.stat }}>{it.title.charAt(0)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: fs * 1.15, fontWeight: theme.font.weights.semibold, color: theme.color.text, whiteSpace: "nowrap" }}>{it.title}</span>
                <span style={{ fontSize: fs * 0.8, color: theme.color.textMuted, whiteSpace: "nowrap" }}>{it.time}</span>
              </div>
              {it.body && <div style={{ marginTop: 6, fontSize: fs * 0.9, color: theme.color.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.body}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
