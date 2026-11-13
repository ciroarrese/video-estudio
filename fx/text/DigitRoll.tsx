import React from "react";
import { Easing } from "../../engine";
import { clamp, lerp, progress, roleColor, styleKey, useFx, xform } from "../core";
import type { ColorRole, FxProps } from "../core";
import { baseText } from "./shared";

export type DigitRollProps = FxProps & {
  value: number;
  from?: number;
  /** Texto fijo despues del numero (por ejemplo "%" o " mil"); aterriza al terminar. */
  suffix?: string;
  suffixColor?: ColorRole;
  /** Separador de miles; por defecto ".". Vacio = sin separador. */
  thousands?: string;
  fontSize?: number;
  color?: ColorRole;
  weight?: number;
};

/** Cantidad de digitos (enteros) de `n`. */
export const digitCount = (n: number) => String(Math.max(0, Math.round(Math.abs(n)))).length;

/** Posicion (en digitos) de la rueda de cada lugar `k` para el valor `v`: lleva el acarreo suave de tipo cuentakilometros. */
export function wheelPos(v: number, k: number): number {
  if (k === 0) return v;
  const unit = Math.pow(10, k);
  const d = Math.floor(v / unit + 1e-9);
  const f = (v - d * unit) / unit;
  return d + clamp((f - 0.9) / 0.1);
}

/** Numero grande que cuenta con cada digito en una ranura de ancho fijo (sin saltos de maquetacion) y un sufijo que aterriza. */
export function DigitRoll(props: DigitRollProps) {
  const { value, from = 0, suffix, suffixColor = "accent", thousands = ".", style } = props;
  const { local, theme } = useFx(props);
  const fs = props.fontSize ?? theme.type.stat;
  const duration = props.duration ?? 60;
  const p = progress(local, 0, duration, Easing.out);
  const v = lerp(from, value, p);
  const N = Math.max(digitCount(value), digitCount(from));
  const vis = digitCount(v);
  const slotW = fs * 0.62;
  const lineH = fs * 1.1;
  const sufP = progress(local, duration - 6, 16, Easing.lands);
  const slots: React.ReactNode[] = [];
  for (let k = N - 1; k >= 0; k--) {
    const shown = k < vis || k === 0;
    const pos = wheelPos(v, k) % 10;
    const wheel: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: slotW, transform: xform({ y: -pos * lineH, round: true }) };
    slots.push(
      <span
        key={k}
        data-qa-ignore="clip overlap covered offscreen safe-area"
        style={{ display: "inline-block", position: "relative", width: slotW, height: lineH, overflow: "hidden", opacity: shown ? 1 : 0 }}
      >
        <span key={styleKey(wheel)} style={wheel}>
          {Array.from({ length: 11 }, (_, d) => (
            <span key={d} style={{ display: "block", height: lineH, lineHeight: `${lineH}px`, textAlign: "center" }}>
              {d % 10}
            </span>
          ))}
        </span>
      </span>,
    );
    if (thousands && k > 0 && k % 3 === 0) {
      slots.push(
        <span key={`s${k}`} style={{ display: "inline-block", width: fs * 0.3, height: lineH, lineHeight: `${lineH}px`, textAlign: "center", opacity: k < vis ? 1 : 0 }}>
          {thousands}
        </span>,
      );
    }
  }
  // El sufijo solo lleva opacidad, tamano y traslado mientras aterriza.
  const sufStyle: React.CSSProperties = {
    display: "inline-block",
    marginLeft: fs * 0.08,
    color: roleColor(theme, suffixColor),
    opacity: sufP > 0 ? undefined : 0,
    fontSize: sufP >= 1 ? undefined : `${(fs * (0.6 + 0.4 * sufP)).toFixed(1)}px`,
    transform: xform({ y: (1 - sufP) * fs * 0.5, round: true }),
  };
  return (
    <div style={{ ...baseText(theme, { fontSize: fs, color: props.color, weight: props.weight ?? theme.font.weights.stat }), display: "flex", alignItems: "center", lineHeight: 1, ...style }}>
      {slots}
      {suffix && (
        <span key={styleKey(sufStyle)} style={sufStyle}>
          {suffix}
        </span>
      )}
    </div>
  );
}

export { DigitRoll as CountUpSlots };
