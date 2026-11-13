import React from "react";
import { Easing } from "../../engine";
import { fxBox, progress, roleColor, stagger, styleKey, useFx, xform } from "../core";
import type { ColorRole } from "../core";
import { measureWidth } from "./measure";
import { staggerScale } from "../../themes";
import { baseText, titleTreatment } from "./shared";
import type { TextFxProps } from "./shared";

export type MaskedRiseProps = TextFxProps & {
  /** Unidad que sube: letras (por defecto) o palabras. */
  by?: "letter" | "word";
  /** Punto de acento que aterriza al final. */
  dot?: boolean;
  dotColor?: ColorRole;
};

type Plan = { each: number; rise: number; units: number; total: number };

/** Tiempos de la animacion: demora entre unidades, duracion de cada subida y total en cuadros (incluye el punto). */
export function maskedRisePlan(text: string, o: { by?: "letter" | "word"; duration?: number; dot?: boolean; /** Factor del paso entre unidades (`staggerScale(theme)`; 1 = el de siempre). */ stagger?: number }): Plan {
  const words = text.split(/\s+/).filter(Boolean);
  const by = o.by ?? "letter";
  const units = by === "word" ? words.length : words.join("").length;
  let each = (by === "word" ? 5 : 2) * (o.stagger ?? 1);
  let rise = by === "word" ? 20 : 16;
  const dotExtra = o.dot ? 10 : 0;
  const natural = Math.max(0, units - 1) * each + rise + dotExtra;
  if (o.duration && o.duration > 0) {
    const k = o.duration / natural;
    each *= k;
    rise *= k;
    return { each, rise, units, total: o.duration };
  }
  return { each, rise, units, total: natural };
}

/** Letras (o palabras) que suben desde una mascara con escalonado, un asentado de escala 108% a 100% y, opcional, un punto que aterriza. */
export function MaskedRise(props: MaskedRiseProps) {
  const { text, by = "letter", dot = false, dotColor = "accent", style } = props;
  const { local, theme } = useFx(props);
  const box = fxBox(props, { width: 0, height: 0 });
  const plan = maskedRisePlan(text, { by, duration: props.duration, dot, stagger: staggerScale(theme) });
  const words = text.split(/\s+/).filter(Boolean);
  const fs = props.fontSize ?? theme.type.h1;
  const tt = titleTreatment(theme, props.weight);
  const font = { family: theme.font.family, weight: tt.weight, letterSpacing: tt.tracking };
  let idx = 0;
  const lastWord = words.length - 1;
  const dotP = progress(local, plan.total - 16, 16, Easing.lands);

  // En reposo (p >= 1) el span no lleva tamano ni transformacion: solo se emiten mientras sube. El asentado 108% -> 100% se hace
  // con el tamano de letra (no con `scale`): una escala deja el texto rasterizado segun el historial de cuadros.
  const inner = (p: number): React.CSSProperties =>
    p >= 1
      ? { display: "block" }
      : { display: "block", fontSize: `${(fs * (1 + 0.08 * (1 - p))).toFixed(1)}px`, transform: xform({ y: (1 - p) * fs * 1.36, round: true }), transformOrigin: "0% 100%" };

  const dotStyle: React.CSSProperties = {
    display: "inline-block",
    width: `${(fs * 0.17).toFixed(2)}px`,
    height: `${(fs * 0.17).toFixed(2)}px`,
    borderRadius: "50%",
    background: roleColor(theme, dotColor),
    marginLeft: "0.07em",
    marginBottom: "0.2em",
    opacity: dotP > 0 ? undefined : 0,
    transform: xform({ y: -(1 - dotP) * fs * 0.9 }),
  };

  const rise = (i: number) => progress(local, stagger(i, { each: plan.each }), plan.rise, Easing.out);

  return (
    <div
      style={{
        ...baseText(theme, props, true),
        display: "flex",
        flexWrap: "wrap",
        columnGap: "0.28em",
        justifyContent: props.align === "center" ? "center" : props.align === "right" ? "flex-end" : "flex-start",
        width: box.width || undefined,
        ...style,
      }}
    >
      {words.map((w, wi) => {
        const chars = by === "word" ? [w] : Array.from(w);
        return (
          <span key={wi} style={{ display: "inline-flex", alignItems: "flex-end" }}>
            {chars.map((ch, ci) => {
              const p = rise(by === "word" ? wi : idx++);
              return (
                <span
                  key={ci}
                  data-qa-ignore="clip overlap offscreen"
                  style={{ display: "inline-block", overflow: "hidden", width: measureWidth(ch, fs, font), height: `${(fs * 1.15).toFixed(2)}px`, lineHeight: `${(fs * 1.15).toFixed(2)}px`, padding: "0 0.12em 0.14em", margin: "0 -0.12em -0.14em", whiteSpace: "nowrap" }}
                >
                  <span key={styleKey(inner(p))} style={inner(p)}>
                    {ch}
                  </span>
                </span>
              );
            })}
            {dot && wi === lastWord && (
              <span key={styleKey(dotStyle)} style={dotStyle} />
            )}
          </span>
        );
      })}
    </div>
  );
}
