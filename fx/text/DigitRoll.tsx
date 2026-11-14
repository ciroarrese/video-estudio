import React from "react";
import { Easing } from "../../engine";
import { clamp, lerp, progress, roleColor, styleKey, useFx, xform } from "../core";
import type { ColorRole, FxProps } from "../core";
import { textLook } from "../../themes";
import { baseText } from "./shared";
import { decoration, decorationHost, landStyle } from "./look";

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
  const rest = p >= 1 && Number.isInteger(value);
  const sufP = progress(local, duration - 6, 16, Easing.lands);
  const slots: React.ReactNode[] = [];
  for (let k = N - 1; k >= 0; k--) {
    const shown = k < vis || k === 0;
    // En reposo (la cuenta terminó y el valor es entero) el dígito se dibuja quieto, sin rueda ni recorte: se juzga como cualquier texto.
    if (rest) {
      slots.push(
        <span key={k} style={{ display: "inline-block", position: "relative", minWidth: slotW, height: lineH, lineHeight: `${lineH}px`, textAlign: "center", opacity: shown ? 1 : 0 }}>
          {Math.floor(value / Math.pow(10, k)) % 10}
        </span>,
      );
    } else {
      const pos = wheelPos(v, k) % 10;
      const wheel: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: slotW, transform: xform({ y: -pos * lineH, round: true }) };
      slots.push(
        <span
          key={k}
          style={{ display: "inline-block", position: "relative", width: slotW, height: lineH, overflow: "hidden", opacity: shown ? 1 : 0 }}
        >
          <span key={styleKey(wheel)} style={wheel}>
            {Array.from({ length: 11 }, (_, d) => {
              // Mientras rueda, la ranura recorta la rueda a propósito. Los dígitos que quedan del todo fuera de la ventana no se ven (el recorte
              // los oculta): `qa` no los juzga (`all`; es una copia que no se ve). Los que asoman en la ventana (el actual y, al girar, el
              // vecino) se juzgan en todo salvo `clip` (se ven partidos a propósito) y `overlap` (el vecino pasa pegado al actual).
              const visible = Math.abs(d - pos) < 1;
              return (
                <span key={d} aria-hidden={visible ? undefined : "true"} data-qa-ignore={visible ? "clip overlap" : "all"} style={{ display: "block", height: lineH, lineHeight: `${lineH}px`, textAlign: "center" }}>
                  {d % 10}
                </span>
              );
            })}
          </span>
        </span>,
      );
    }
    if (thousands && k > 0 && k % 3 === 0) {
      slots.push(
        <span key={`s${k}`} style={{ display: "inline-block", minWidth: fs * 0.3, height: lineH, lineHeight: `${lineH}px`, textAlign: "center", opacity: k < vis ? 1 : 0 }}>
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
    ...landStyle(theme, sufP, fs, true),
  };
  const deco = textLook(theme).decoration !== "none";
  return (
    <div style={{ ...baseText(theme, { fontSize: fs, color: props.color, weight: props.weight ?? theme.font.weights.stat }), display: "flex", alignItems: "center", lineHeight: 1, ...(deco ? { width: "fit-content", ...decorationHost(theme) } : {}), ...style }}>
      {slots}
      {suffix && (
        <span key={styleKey(sufStyle)} style={sufStyle}>
          {suffix}
        </span>
      )}
      {decoration(theme, progress(local, duration - 6, 14, Easing.out), fs, roleColor(theme, "accent"))}
    </div>
  );
}

export { DigitRoll as CountUpSlots };
