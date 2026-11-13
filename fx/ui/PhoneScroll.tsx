import type React from "react";
import { kf } from "../../kit";
import { chartColor, fxBox, useFx } from "../core";
import type { FxProps } from "../core";
import { PhoneFrame, phoneScreen } from "./PhoneFrame";

export type PhoneScrollProps = FxProps & {
  /** Contenido alto; por defecto una lista de ejemplo. */
  children?: React.ReactNode;
  /** Alto del contenido en px (hace falta si pasas `children`). */
  contentHeight?: number;
};

/** Desplazamiento (px) y geometria de la barra: sube con pausas y llega al final. */
export function scrollState(t: number, contentH: number, screenH: number): { offset: number; thumbH: number; thumbY: number } {
  const maxOff = Math.max(0, contentH - screenH);
  const k = kf(t, [0, 0.18, 0.5, 0.62, 1], [0, 0, 0.55, 0.55, 1]);
  const offset = maxOff * k;
  const thumbH = Math.max(40, (screenH * screenH) / contentH);
  return { offset, thumbH, thumbY: maxOff === 0 ? 0 : (offset / maxOff) * (screenH - thumbH - 16) + 8 };
}

/** Telefono cuyo contenido se desplaza, con barra de desplazamiento y recorte en las esquinas de la pantalla. */
export function PhoneScroll(p: PhoneScrollProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 380, height: 760 });
  const dur = p.duration ?? 80;
  const scr = phoneScreen(w, h);
  const rows = 11;
  const contentH = p.children ? p.contentHeight ?? scr.height * 1.8 : 96 * rows + 130;
  const s = scrollState(Math.min(1, Math.max(0, local / dur)), contentH, scr.height);
  const fs = theme.type.eyebrow;
  return (
    <PhoneFrame {...p} width={w} height={h}>
      <div data-qa-ignore="offscreen covered" style={{ position: "absolute", left: 0, top: 0, width: scr.width, height: contentH, transform: `translateY(${(-s.offset).toFixed(2)}px)` }}>
        {p.children ?? (
          <div>
            <div style={{ padding: "64px 26px 14px", fontSize: fs * 1.4, fontWeight: theme.font.weights.stat, color: theme.color.text }}>Actividad</div>
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} style={{ height: 96, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 18, padding: "0 26px" }}>
                <div style={{ width: 52, height: 52, flex: "none", borderRadius: theme.radius.pill, background: chartColor(theme, i) }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: fs, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>Elemento {i + 1}</div>
                  <div style={{ marginTop: 6, height: 12, width: `${60 + ((i * 17) % 30)}%`, background: theme.color.border, borderRadius: theme.radius.sm }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", right: 7, top: s.thumbY, width: 7, height: s.thumbH, background: theme.color.textMuted, opacity: 0.7, clipPath: `inset(0 round ${theme.radius.pill}px)` }} />
    </PhoneFrame>
  );
}
