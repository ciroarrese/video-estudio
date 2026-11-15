import React from "react";
import { Easing } from "../../engine";
import { clamp, fxDensity, lerp, progress, roleColor, styleKey, useFx, xform } from "../core";
import type { ColorRole, FxProps } from "../core";
import { textLook } from "../../themes";
import { baseText } from "./shared";
import { decoration, decorationHost, landStyle } from "./look";
import { measureWidth } from "./measure";

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
  // `density` (fx/core/density.ts): con un número, la letra se escala por él; con `"auto"` y un `width`, baja lo justo para que la cifra con su sufijo entre
  // en ese ancho (nunca crece). Sin `density`, el tamaño de siempre.
  const fs0 = props.fontSize ?? theme.type.stat;
  let fs = fs0;
  if (props.density !== undefined) {
    if (props.density === "auto") {
      const N0 = Math.max(digitCount(value), digitCount(from));
      const est = N0 * fs0 * 0.62 + (thousands ? Math.floor((N0 - 1) / 3) * fs0 * 0.3 : 0) + (suffix ? measureWidth(suffix, fs0, { family: theme.font.family, weight: props.weight ?? theme.font.weights.stat }) + fs0 * 0.08 : 0);
      const room = props.width ?? props.size;
      fs = room !== undefined && est > room ? fs0 * Math.max(0.3, room / est) : fs0;
    } else fs = fs0 * fxDensity(props.density, { width: 1, height: 1 }, { width: 1, height: 1 });
  }
  const duration = props.duration ?? 60;
  const p = progress(local, 0, duration, Easing.out);
  const v = lerp(from, value, p);
  const N = Math.max(digitCount(value), digitCount(from));
  const vis = digitCount(v);
  // Ranura de cada dígito: 0,62 de la letra, o el ancho del dígito más ancho de la tipografía si pasa de ahí en más de un 15 % (una fuente
  // más ancha ensancha la ranura en vez de pisar al vecino). Si el dígito pasa de 0,62 por poco (la tipografía de siempre), en reposo el
  // avance sigue siendo 0,62: `squeeze` descuenta ese poco, así la cifra mide lo mismo que cuando la rueda recorta la ranura.
  const digitW = Math.max(...Array.from("0123456789", (d) => measureWidth(d, fs, { family: theme.font.family, weight: props.weight ?? theme.font.weights.stat })));
  const base = fs * 0.62;
  const wide = digitW > base * 1.15;
  const slotW = wide ? digitW : base;
  const digitFont = { family: theme.font.family, weight: props.weight ?? theme.font.weights.stat };
  // El separador igual: ranura de 0,3 de la letra, con el mismo descuento si la tipografía lo dibuja apenas más ancho.
  const sepW = thousands ? measureWidth(thousands, fs, digitFont) : 0;
  const sepSqueeze = sepW > fs * 0.3 * 1.25 ? 0 : Math.max(0, sepW - fs * 0.3);
  const squeezeOf = (d: number) => (wide ? 0 : Math.max(0, measureWidth(String(d), fs, digitFont) - base));
  const lineH = fs * 1.1;
  const rest = p >= 1 && Number.isInteger(value);
  const sufP = progress(local, duration - 6, 16, Easing.lands);
  const slots: React.ReactNode[] = [];
  for (let k = N - 1; k >= 0; k--) {
    const shown = k < vis || k === 0;
    // En reposo (la cuenta terminó y el valor es entero) el dígito se dibuja quieto, sin rueda ni recorte: se juzga como cualquier texto.
    if (rest) {
      const dig = Math.floor(value / Math.pow(10, k)) % 10;
      slots.push(
        <span key={`${k}r`} style={{ display: "inline-block", position: "relative", minWidth: slotW, marginRight: -squeezeOf(dig), height: lineH, lineHeight: `${lineH}px`, textAlign: "center", opacity: shown ? 1 : 0 }}>
          {dig}
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
        <span key={`s${k}`} style={{ display: "inline-block", minWidth: fs * 0.3, marginRight: -sepSqueeze, height: lineH, lineHeight: `${lineH}px`, textAlign: "center", opacity: k < vis ? 1 : 0 }}>
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
