import { Easing } from "../../engine";
import { fxBox, progress, roleColor, stagger, useFx } from "../core";
import type { ColorRole } from "../core";
import { baseText } from "./shared";
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
export function maskedRisePlan(text: string, o: { by?: "letter" | "word"; duration?: number; dot?: boolean }): Plan {
  const words = text.split(/\s+/).filter(Boolean);
  const by = o.by ?? "letter";
  const units = by === "word" ? words.length : words.join("").length;
  let each = by === "word" ? 5 : 2;
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
  const plan = maskedRisePlan(text, { by, duration: props.duration, dot });
  const words = text.split(/\s+/).filter(Boolean);
  const fs = props.fontSize ?? theme.type.h1;
  let idx = 0;
  const lastWord = words.length - 1;
  const dotP = progress(local, plan.total - 16, 16, Easing.lands);

  const rise = (i: number) => progress(local, stagger(i, { each: plan.each }), plan.rise, Easing.out);

  return (
    <div
      style={{
        ...baseText(theme, props),
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
                  data-qa-ignore="clip"
                  style={{ display: "inline-block", overflow: "hidden", lineHeight: 1.15, padding: "0 0.02em 0.14em", margin: "0 -0.02em -0.14em" }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      transform: p >= 1 ? undefined : `translateY(${Math.round((1 - p) * fs * 1.36)}px)`,
                      transformOrigin: "0% 100%",
                    }}
                  >
                    {ch}
                  </span>
                </span>
              );
            })}
            {dot && wi === lastWord && (
              <span
                style={{
                  display: "inline-block",
                  width: `${(fs * 0.17).toFixed(2)}px`,
                  height: `${(fs * 0.17).toFixed(2)}px`,
                  borderRadius: "50%",
                  background: roleColor(theme, dotColor),
                  marginLeft: "0.07em",
                  marginBottom: "0.2em",
                  opacity: dotP > 0 ? 1 : 0,
                  transform: `translateY(${(-(1 - dotP) * fs * 0.9).toFixed(2)}px)`,
                }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
