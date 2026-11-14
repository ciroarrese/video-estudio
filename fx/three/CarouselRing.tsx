import React from "react";
import { Easing, fade, lerp, progress, styleKey, xform } from "../core";
import { camera, sortBackToFront } from "./math";
import { cornerRadius, textStyle } from "../../themes";
import { cardSurface, stepDelay, useThreeFx } from "./common";
import type { ThreeProps } from "./common";

export type CarouselRingProps = ThreeProps & {
  /** Tarjetas (cualquier contenido plano). Por defecto, `count` tarjetas de muestra. */
  children?: React.ReactNode;
  count?: number;
  cardWidth?: number;
  cardHeight?: number;
};

/** N tarjetas sobre un anillo que gira; las de atrás, más chicas y apagadas. La tarjeta 0 termina al frente. */
export function CarouselRing(p: CarouselRingProps) {
  const { local, t, duration, width, height, theme, pal } = useThreeFx(p, { width: 1500, height: 760, duration: 75 });
  const kids = React.Children.toArray(p.children);
  const n = kids.length || (p.count ?? 6);
  const cw = p.cardWidth ?? 300;
  const ch = p.cardHeight ?? 400;
  const R = 2.6, D = 8;
  const unit = Math.min(width / 8.5, 190);
  const cam = camera({ distance: D, tilt: 0.22, unit });
  const rot = (1 - Easing.inOut(t)) * -Math.PI * 1.0;
  const enter = (i: number) => progress(local, stepDelay(theme, i, n, 3, duration - 20 - 4), 20, Easing.lands);
  const cards = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rot;
    const pos = { x: Math.sin(a) * R, y: 0, z: Math.cos(a) * R };
    const pr = cam.project(pos);
    const front = (pos.z + R) / (2 * R); // 0 atrás, 1 al frente
    return { i, pr, front };
  });
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", ...p.style }}>
      {sortBackToFront(cards, (c) => c.pr.depth).map((c, z) => {
        const e = enter(c.i);
        const s = c.pr.scale * lerp(0.6, 1, e);
        const st: React.CSSProperties = {
          position: "absolute",
          left: Math.round(width / 2 + c.pr.x - cw / 2),
          top: Math.round(height / 2 + c.pr.y - ch / 2),
          width: cw,
          height: ch,
          boxSizing: "border-box",
          // Escala y opacidad solo cuando no son identidad (en reposo no queda `scale(1)` ni `opacity: 0.99`).
          transform: xform({ scale: s }),
          transformOrigin: "50% 50%",
          opacity: fade(lerp(0.5, 1, Math.pow(c.front, 0.8)) * Math.min(1, e * 2)),
          zIndex: z,
          // Forma, relleno, borde y sombra del design system (por defecto: radio `lg`, borde de 2 px y sin sombra).
          ...cardSurface(theme, { alt: c.front <= 0.85, accent: c.front > 0.92 ? pal.accent : undefined, guide: c.front <= 0.85 }),
          overflow: "hidden",
          fontFamily: theme.font.family,
        };
        return (
          <div
            key={`${c.i}:${styleKey(st)}:${c.front < 0.85 ? "o" : ""}`}
            // Oclusión intencional: las tarjetas de atrás quedan tapadas por la de adelante (`covered`); su contraste, en cambio, se juzga (la atenuación tiene piso)
            data-qa-ignore={c.front < 0.85 ? "covered" : undefined}
            style={st}
          >
            {kids.length ? kids[c.i] : (
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, height: "100%", boxSizing: "border-box", justifyContent: "flex-end" }}>
                <div style={{ width: 52, height: 52, borderRadius: cornerRadius(theme, "control"), background: c.i % 2 ? pal.accent2 : pal.accent }} />
                <div style={{ fontSize: theme.type.caption, ...textStyle(theme, "title"), color: pal.ink }}>{`Tarjeta ${c.i + 1}`}</div>
                <div style={{ height: 8, borderRadius: Math.min(4, cornerRadius(theme, "bar")), background: pal.line, opacity: 0.35 }} />
                <div style={{ height: 8, width: "70%", borderRadius: Math.min(4, cornerRadius(theme, "bar")), background: pal.line, opacity: 0.35 }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
