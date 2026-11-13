import React from "react";
import { Easing, lerp, progress } from "../core";
import { useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type CardFlipProps = ThreeProps & {
  /** Cara frontal (se ve al principio). */
  front?: React.ReactNode;
  /** Cara trasera (se ve al final). */
  back?: React.ReactNode;
  /** Tamaño de la tarjeta en px. */
  cardWidth?: number;
  cardHeight?: number;
};

/** Tarjeta que da media vuelta; la cara que no mira al espectador se oculta por ángulo. Proyección a mano: escala en X y en Y, sin `rotateY`. */
export function CardFlip(p: CardFlipProps) {
  const { local, duration, width, height, theme, pal } = useThreeFx(p, { width: 900, height: 600, duration: 75 });
  const cw = p.cardWidth ?? Math.min(width * 0.8, 1000);
  const ch = p.cardHeight ?? Math.min(height * 0.8, 620);
  const sc = Math.min(cw / 620, ch / 400);
  const k = progress(local, 6, Math.max(1, duration - 18), Easing.inOut);
  const ang = Math.PI * k;
  const c = Math.cos(ang), s = Math.sin(ang);
  const showFront = c >= 0;
  const sx = Math.max(0.0001, Math.abs(c));
  const grow = 1 + 0.1 * s; // la tarjeta se "acerca" mientras gira
  const lift = Math.round(lerp(0, 26 * sc, s));
  const shadeA = 0.28 * s;
  const placeholder = (title: string, hint: string, accent: boolean) => (
    <div style={{ padding: Math.round(36 * sc), display: "flex", flexDirection: "column", gap: Math.round(14 * sc), height: "100%", boxSizing: "border-box", justifyContent: "center" }}>
      <div style={{ width: Math.round(64 * sc), height: Math.round(64 * sc), borderRadius: theme.radius.md, background: accent ? pal.accent : pal.line, opacity: accent ? 1 : 0.5 }} />
      <div style={{ fontSize: theme.type.h1, fontWeight: theme.font.weights.stat, color: pal.ink, lineHeight: 1.05 }}>{title}</div>
      <div style={{ fontSize: theme.type.body, color: theme.color.textMuted }}>{hint}</div>
    </div>
  );
  return (
    <div style={{ position: "relative", width, height, ...p.style }}>
      <div
        style={{
          position: "absolute",
          left: (width - cw) / 2,
          top: (height - ch) / 2,
          width: cw,
          height: ch,
          boxSizing: "border-box",
          borderRadius: theme.radius.lg,
          background: showFront ? theme.color.surface : theme.color.surfaceAlt,
          border: `2px solid ${showFront ? theme.color.border : pal.accent}`,
          overflow: "hidden",
          transform: `translateY(${-lift}px) scale(${sx * grow}, ${grow})`,
          transformOrigin: "50% 50%",
          visibility: sx < 0.012 ? "hidden" : "visible",
          fontFamily: theme.font.family,
        }}
      >
        {showFront ? p.front ?? placeholder("Anverso", "Primera cara", false) : p.back ?? placeholder("Reverso", "Segunda cara", true)}
        <div style={{ position: "absolute", inset: 0, background: pal.darkest, opacity: shadeA }} />
      </div>
    </div>
  );
}
