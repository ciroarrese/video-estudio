import React from "react";
import { Easing } from "../../engine";
import { chartColor, fade, fxBox, progress, styleKey, useFx, xform } from "../core";
import type { FxProps } from "../core";
import { staggerT } from "../data/geom";

export type FanCard = { title: string; text?: string };
export type CardFanProps = FxProps & {
  items?: FanCard[];
  /** Contenido propio por tarjeta (reemplaza a `items`). */
  children?: React.ReactNode;
  /** Apertura total del abanico, en grados. */
  spread?: number;
};

const DEFAULT: FanCard[] = [
  { title: "Idea", text: "Primer borrador" },
  { title: "Diseño", text: "Estructura y estilo" },
  { title: "Prueba", text: "Ajustes finos" },
  { title: "Entrega", text: "Versión final" },
  { title: "Aviso", text: "Se comparte" },
];

/** Angulo y desplazamiento horizontal de la tarjeta `i` de `n` cuando el abanico esta abierto. */
export function fanPose(i: number, n: number, spread: number, gap: number): { angle: number; dx: number } {
  const k = n <= 1 ? 0 : i / (n - 1) - 0.5;
  return { angle: k * spread, dx: k * gap * (n - 1) };
}

/** N tarjetas que salen de una pila y se abren en abanico. */
export function CardFan(p: CardFanProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 560 });
  const kids = p.children ? React.Children.toArray(p.children) : null;
  const items = p.items ?? DEFAULT;
  const n = kids ? kids.length : items.length;
  const dur = p.duration ?? 65;
  const spread = p.spread ?? 56;
  const cw = Math.min(260, w / (n * 0.5 + 0.8)), ch = cw * 1.32;
  const gap = Math.min(70, (w - cw - 40) / Math.max(1, n - 1));
  const gT = progress(local, 0, dur * 0.2, Easing.out);
  const fs = theme.type.eyebrow;
  // Sin sombra: bajo rotate() una sombra (con o sin desenfoque) no rasteriza igual según el historial; el borde inferior grueso da el relieve.
  return (
    <div style={{ position: "relative", width: w, height: h, fontFamily: theme.font.family, ...p.style }}>
      {Array.from({ length: n }, (_, i) => {
        const pose = fanPose(i, n, spread, gap);
        // el orden de salida es de afuera hacia el centro de la pila: las del medio salen primero
        const t = Easing.lands(staggerT(progress(local, dur * 0.12, dur * 0.88), i, n, 0.45));
        const a = pose.angle * t, x = pose.dx * t;
        const stackY = (i - (n - 1) / 2) * -3 * (1 - t);
        const enter = gT;
        // Traslado, giro y opacidad solo mientras la tarjeta sale (en reposo del todo no queda ninguno).
        const cardSt: React.CSSProperties = { position: "absolute", left: (w - cw) / 2, top: h - ch - 40, width: cw, height: ch, boxSizing: "border-box", transformOrigin: "50% 130%", transform: xform({ x: Math.round(x), y: Math.round(stackY + (1 - enter) * 30), rotate: a, round: true }), opacity: fade(enter), zIndex: i, background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.lg, borderBottom: `5px solid ${theme.color.border}`, padding: 22, overflow: "hidden" };
        return (
          <div key={`${i}:${styleKey(cardSt)}`} data-qa-ignore="overlap covered" style={cardSt}>
            {kids ? kids[i] : (
              <>
                <div style={{ width: 44, height: 44, borderRadius: theme.radius.pill, background: chartColor(theme, i) }} />
                <div style={{ marginTop: 22, fontSize: fs * 1.3, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>{items[i]!.title}</div>
                {items[i]!.text && <div style={{ marginTop: 8, fontSize: fs * 0.85, color: theme.color.textMuted }}>{items[i]!.text}</div>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
