import type React from "react";
import { kf } from "../../kit";
import { cornerRadius } from "../../themes";
import { chartColor, fade, fxBox, styleKey, useFx, xform } from "../core";
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

/** Opacidad de un bloque de texto que ocupa [top, bottom] (px de la pantalla): se desvanece antes de llegar al borde, así nunca queda una línea cortada a la mitad. */
export function edgeFade(top: number, bottom: number, screenH: number, margin = 4): number {
  const inside = Math.min(top, screenH - bottom);
  return Math.min(1, Math.max(0, inside / margin));
}

/** Telefono cuyo contenido se desplaza, con barra de desplazamiento y recorte en las esquinas de la pantalla. */
export function PhoneScroll(p: PhoneScrollProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 380, height: 760 });
  const dur = p.duration ?? 80;
  const scr = phoneScreen(w, h);
  const rows = 11;
  const fs = theme.type.eyebrow;
  const headTop = 64, headH = Math.round(fs * 1.4 * 1.3), headEnd = headTop + headH + 14;
  const rowH = 96;
  const contentH = p.children ? p.contentHeight ?? scr.height * 1.8 : 96 * rows + headEnd;
  const s = scrollState(Math.min(1, Math.max(0, local / dur)), contentH, scr.height);
  // El desplazamiento solo se emite si hay (en reposo arriba no queda `translateY(0px)`).
  const scrollSt: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: scr.width, height: contentH, transform: xform({ y: -s.offset }) };
  return (
    <PhoneFrame {...p} width={w} height={h}>
      <div key={styleKey(scrollSt)} data-qa-ignore="offscreen covered" style={scrollSt}>
        {p.children ?? (
          <div>
            <div style={{ padding: `${headTop}px 26px 14px`, opacity: fade(edgeFade(headTop - s.offset, headTop + headH - s.offset, scr.height)), fontSize: fs * 1.4, fontWeight: theme.font.weights.stat, color: theme.color.text }}>Actividad</div>
            {Array.from({ length: rows }, (_, i) => {
              // Alto de la línea de texto dentro de la fila (fila de 96 px, bloque centrado).
              const top = headEnd + i * rowH + 16 - s.offset;
              return (
              <div key={i} style={{ height: rowH, opacity: fade(edgeFade(top, top + rowH - 32, scr.height)), boxSizing: "border-box", display: "flex", alignItems: "center", gap: 18, padding: "0 26px" }}>
                <div style={{ width: 52, height: 52, flex: "none", borderRadius: cornerRadius(theme, "chip"), background: chartColor(theme, i) }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: fs, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>Elemento {i + 1}</div>
                  <div style={{ marginTop: 6, height: 12, width: `${60 + ((i * 17) % 30)}%`, background: theme.color.border, borderRadius: Math.min(theme.radius.sm, cornerRadius(theme, "control")) }} />
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", right: 7, top: s.thumbY, width: 7, height: s.thumbH, background: theme.color.textMuted, opacity: 0.7, clipPath: `inset(0 round ${theme.radius.pill}px)` }} />
    </PhoneFrame>
  );
}
