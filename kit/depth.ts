import type React from "react";
import { clamp } from "./util";

export interface FlyInZOptions {
  /** Distancia en profundidad desde la que llega, en px (por defecto 900). Positiva: llega desde lejos y crece; negativa: llega desde adelante y se achica. Su valor absoluto tiene que ser menor que `perspective`. */
  from?: number;
  /** Distancia de la perspectiva propia del elemento, en px (por defecto 1400). Menor = más exagerada. */
  perspective?: number;
  /** Desplazamiento lateral y vertical de partida, en px, que se recorre junto con la profundidad. */
  x?: number;
  y?: number;
  /** Inclinación de partida en grados, que se deshace con el progreso. */
  rotateX?: number;
  rotateY?: number;
  /** Aparece en fundido junto con el vuelo (por defecto sí). */
  fade?: boolean;
}

const r2 = (v: number) => +v.toFixed(2);

/**
 * Entrada de un elemento volando en profundidad (eje z), pura del progreso: `progress` va de 0 (lejos) a 1 (en su lugar) y
 * suele salir de `kf(frame, [ini, fin], [0, 1], easing)`. Devuelve el `style` para el propio elemento:
 * `<div style={{ position: "absolute", left, top, ...flyInZ(p) }}>`.
 *
 * Cumple la regla de profundidad de `docs/reglas.md`: la perspectiva es `perspective()` dentro del `transform` de cada elemento
 * (nunca `perspective` ni `preserve-3d` en un ancestro), todo el movimiento va en `transform` y el layout (`left`/`top`) lo ponés vos en enteros.
 * Una vez que llegó (`progress >= 1`) devuelve `{}`: sin `transform` ni `opacity` residuales (ver "Residuos en elementos quietos" en `docs/reglas.md`).
 * Con `progress <= 0` el elemento queda invisible si `fade` está activo.
 */
export function flyInZ(progress: number, opts: FlyInZOptions = {}): React.CSSProperties {
  const { from = 900, perspective = 1400, x = 0, y = 0, rotateX = 0, rotateY = 0, fade = true } = opts;
  if (!(perspective > 0)) throw new Error(`flyInZ: perspective tiene que ser mayor que 0 (recibió ${perspective})`);
  if (Math.abs(from) >= perspective) {
    throw new Error(`flyInZ: |from| (${Math.abs(from)}) tiene que ser menor que perspective (${perspective}); si no, el elemento queda detrás de la cámara`);
  }
  const p = clamp(progress, 0, 1);
  if (p >= 1) return {};
  const k = 1 - p;
  const parts = [`perspective(${perspective}px)`, `translate3d(${r2(x * k)}px, ${r2(y * k)}px, ${r2(-from * k)}px)`];
  if (rotateX) parts.push(`rotateX(${r2(rotateX * k)}deg)`);
  if (rotateY) parts.push(`rotateY(${r2(rotateY * k)}deg)`);
  return { transform: parts.join(" "), ...(fade ? { opacity: r2(p) } : {}) };
}
