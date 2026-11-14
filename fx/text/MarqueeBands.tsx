import React from "react";
import { Easing } from "../../engine";
import { fxBox, progress, roleColor, useFx } from "../core";
import type { ColorRole, FxProps } from "../core";
import { measureWidth } from "./measure";
import { textLook } from "../../themes";
import { mix } from "../core";

/** Separador según la forma de punto del tema (`style.line.dotShape`); el redondo es el de siempre. */
const SEPARATORS = { round: "•", square: "\u25AA", cross: "+" } as const;

export type MarqueeBandsProps = FxProps & {
  /** Una frase por banda (2 o 3). */
  lines: string[];
  /** Inclinacion del conjunto en grados. */
  angle?: number;
  fontSize?: number;
  /** Px por cuadro de desplazamiento. */
  speed?: number;
  separator?: string;
  pairs?: { bg: ColorRole; fg: ColorRole }[];
};

const PAIRS: { bg: ColorRole; fg: ColorRole }[] = [
  { bg: "accent", fg: "onAccent" },
  { bg: "text", fg: "bg" },
  { bg: "surfaceAlt", fg: "text" },
];

/** Desplazamiento (px, 0 <= x < unit) de una banda tras `s` px de recorrido y direccion `dir` (-1 izquierda, 1 derecha). Funcion pura para pruebas. */
export function marqueeShift(s: number, unit: number, dir: 1 | -1): number {
  const m = ((s % unit) + unit) % unit;
  return dir === -1 ? -m : m - unit;
}

/** Dos o tres bandas inclinadas con texto que se repite y se desliza en sentidos opuestos. Entran de costado; el desplazamiento se detiene al terminar `duration`. */
export function MarqueeBands(props: MarqueeBandsProps) {
  const { lines, angle = -6, speed = 12, pairs = PAIRS, style } = props;
  const { local, theme } = useFx(props);
  const look = textLook(theme);
  const separator = props.separator ?? SEPARATORS[look.dotShape];
  const outline = look.tile === "outline";
  const box = fxBox(props, { width: 1920, height: 1080 });
  const fs = props.fontSize ?? theme.type.h2;
  const duration = props.duration ?? 75;
  const bh = Math.round(fs * 1.55);
  const gap = Math.round(fs * 0.5);
  const n = lines.length;
  const font = { family: theme.font.family, weight: theme.font.weights.stat };
  const span = box.width * 1.7;
  // `outline`: banda hueca con contorno del color de la banda y texto de ese color (sobre el fondo, con la tinta si la banda es `surfaceAlt`); el resto, llena.
  const bandPaint = (j: number): React.CSSProperties => {
    const pair = pairs[j % pairs.length]!;
    if (!outline) return { background: roleColor(theme, pair.bg), color: roleColor(theme, pair.fg) };
    const ink = pair.bg === "surfaceAlt" ? roleColor(theme, pair.fg) : roleColor(theme, pair.bg);
    return { background: roleColor(theme, "bg"), color: ink, boxSizing: "border-box", border: `${Math.max(2, Math.round(fs * 0.04 * look.weightK))}px solid ${ink}`, ...(look.glow > 0 ? { boxShadow: `0 0 ${(fs * 0.4 * look.glow).toFixed(1)}px ${mix(ink, roleColor(theme, "bg"), 0.5)}` } : {}) };
  };
  return (
    <div style={{ position: "relative", width: box.width, height: box.height, overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: box.width, height: box.height, transform: `rotate(${angle}deg)`, transformOrigin: "50% 50%" }}>
        {lines.map((line, j) => {
          const dir: 1 | -1 = j % 2 === 0 ? -1 : 1;
          const unit = measureWidth(`${line}`, fs, font) + gap * 2 + measureWidth(separator, fs, font);
          const reps = Math.ceil(span / unit) + 2;
          const enter = Easing.out(progress(local, j * 4, 26));
          const x = marqueeShift(speed * Math.min(local, duration), unit, dir) + (1 - enter) * -dir * box.width * 1.2 + 0;
          // Copia "real": la que cae entera dentro del cuadro (dentro del margen de seguridad) y más cerca del centro; si ninguna entra
          // (frase más ancha que el cuadro, o la banda todavía entrando), la más cercana al centro. Esa se juzga como cualquier texto.
          // Las demás son repeticiones del mismo texto que el cuadro corta a propósito en sus bordes: `aria-hidden` y fuera del control.
          const tw = measureWidth(line, fs, font);
          const bandLeft = -(span - box.width) / 2 + Math.round(x) + gap;
          const margin = box.width * 0.04;
          let real = 0;
          let best = Infinity;
          for (let r = 0; r < reps; r++) {
            const left = bandLeft + r * unit;
            const inside = left >= margin && left + tw <= box.width - margin;
            const score = Math.abs(left + tw / 2 - box.width / 2) + (inside ? 0 : box.width * 10);
            if (score < best) {
              best = score;
              real = r;
            }
          }
          // `overlap` solo en la banda inclinada: `qa` aproxima cada línea rotada por su caja envolvente y las de bandas vecinas se pisan
          // aunque las letras no se toquen (con `angle` 0 las bandas son rectas y se juzgan normal).
          const y = box.height / 2 + (j - (n - 1) / 2) * (bh + 12) - bh / 2;
          return (
            <div key={j} data-qa-ignore={angle !== 0 ? "overlap" : undefined} style={{ position: "absolute", left: -(span - box.width) / 2, top: y, width: span, height: bh, ...bandPaint(j), overflow: "visible" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: bh, width: span, display: "flex", alignItems: "center", transform: `translateX(${Math.round(x)}px)`, fontFamily: theme.font.family, fontWeight: font.weight, fontSize: fs, whiteSpace: "nowrap" }}>
                {Array.from({ length: reps }, (_, r) => (
                  <span
                    key={`${r}${r === real ? "r" : ""}`}
                    aria-hidden={r === real ? undefined : "true"}
                    data-qa-ignore={r === real ? undefined : "all"}
                    style={{ display: "inline-block", flex: "none", width: unit, paddingLeft: gap, boxSizing: "border-box" }}
                  >
                    {line}
                    {/* el separador es adorno de la banda: no lleva mensaje, así que no se juzga su tamaño ni su contraste (sí su recorte) */}
                    <span aria-hidden="true" data-qa-decor="" style={{ display: "inline-block", marginLeft: gap, opacity: 0.7 }}>{separator}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
