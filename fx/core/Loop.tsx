import React from "react";
import { Sequence, useFrame } from "../../engine";
import { fade } from "./math";

export type LoopMode = "fade" | "restart" | "pingpong";

export type LoopProps = {
  /** Cuadros que dura la animación del efecto hasta quedar compuesto (el `duration` del efecto). */
  duration: number;
  /** Cuadros de pausa con la imagen final quieta antes de volver a empezar (por defecto 20). */
  pause?: number;
  /** Cuadro (del contexto) en que arranca la primera vuelta (por defecto 0). Antes de él, el efecto está en su cuadro 0. */
  start?: number;
  /**
   * Desfase en cuadros: adelanta (o con signo negativo, atrasa) el ciclo, para que varios lazos en pantalla no pulsen juntos (por ejemplo `i * 7`).
   * Con el desfase, la primera vuelta ya empieza avanzada.
   */
  offset?: number;
  /**
   * Cómo vuelve a empezar:
   * - `fade` (por defecto): la imagen final se funde y la vuelta siguiente entra con un fundido corto; no hay un corte con la pieza vacía.
   * - `restart`: corte seco al cuadro 0 (solo para efectos cuyo cuadro 0 ya es una imagen completa; si no, queda vacía un momento).
   * - `pingpong`: ida y vuelta: avanza, se queda en la imagen final y retrocede por el mismo camino (el efecto se "desarma" y se vuelve a armar); sin cortes ni fundidos.
   */
  mode?: LoopMode;
  /** Cuadros del fundido de salida al final de la pausa y de entrada al empezar la vuelta siguiente (`fade`; por defecto 8 y 6). */
  fadeOut?: number;
  fadeIn?: number;
  /** `true`: también la primera vuelta entra con fundido (por defecto no: ya entra con su contenedor). */
  fadeFirst?: boolean;
  /** Cantidad de vueltas; al terminar, el efecto queda en su imagen final. Por defecto, todas las que entren en el video. */
  times?: number;
  /** Cuadro explícito (por defecto el del contexto). */
  frame?: number;
  /** Estilo del contenedor (por defecto, ocupa su padre: `position: relative; width: 100%; height: 100%`). */
  style?: React.CSSProperties;
  /** El efecto, o una función que recibe el cuadro local y el estado de la vuelta. Adentro, `useFrame()` también es el cuadro local. */
  children?: React.ReactNode | ((local: number, state: LoopState) => React.ReactNode);
};

export type LoopState = {
  /** Cuadro local del efecto en esta vuelta (0 al empezar). En `pingpong`, baja durante la vuelta. */
  local: number;
  /** Número de vuelta (0 la primera). */
  index: number;
  /** Cuadros de una vuelta completa. */
  cycle: number;
  /** Opacidad a aplicar al contenedor (1 = ninguna). */
  opacity: number;
  /** Fase: `play` (anima), `hold` (imagen final quieta), `back` (retrocede, solo `pingpong`) o `done` (terminó todas las `times`). */
  phase: "play" | "hold" | "back" | "done";
};

const ramp = (c: number, a: number, b: number) => (b <= a ? (c >= b ? 1 : 0) : Math.min(1, Math.max(0, (c - a) / (b - a))));

/**
 * Estado de un lazo en un cuadro: función pura (sin estado ni azar), la que usa `Loop`. Sirve para sincronizar otra cosa con el lazo
 * (un número, un sonido, un rótulo) sin envolverla.
 */
export function loopState(frame: number, o: Pick<LoopProps, "duration" | "pause" | "start" | "offset" | "mode" | "fadeOut" | "fadeIn" | "fadeFirst" | "times">): LoopState {
  const dur = Math.max(1, Math.round(o.duration));
  const pause = Math.max(0, Math.round(o.pause ?? 20));
  const mode = o.mode ?? "fade";
  const play = dur, back = mode === "pingpong" ? dur : 0;
  const cycle = play + pause + back;
  const r = Math.max(0, frame - (o.start ?? 0) + (o.offset ?? 0));
  const index = Math.floor(r / cycle);
  if (o.times !== undefined && index >= o.times) return { local: dur, index: o.times - 1, cycle, opacity: 1, phase: "done" };
  const c = r - index * cycle;
  const fOut = Math.min(o.fadeOut ?? 8, pause), fIn = o.fadeIn ?? 6;
  let local: number, phase: LoopState["phase"];
  if (c < play) { local = c; phase = "play"; }
  else if (c < play + pause) { local = dur; phase = "hold"; }
  else { local = dur - (c - play - pause); phase = "back"; }
  let opacity = 1;
  if (mode === "fade") {
    const out = fOut > 0 && !(o.times !== undefined && index === o.times - 1) ? 1 - ramp(c, cycle - fOut, cycle) : 1;
    const inn = index > 0 || o.fadeFirst ? ramp(c, 0, fIn) : 1;
    opacity = +(out * inn).toFixed(4);
  }
  return { local, index, cycle, opacity, phase };
}

/**
 * Repite cualquier efecto (de `fx/` o propio) mientras está en pantalla: es el lazo que un muestrario necesita para no quedar quieto con la imagen final.
 * Es una función pura del cuadro (el cuadro local es un módulo del cuadro del contexto), sin estado, azar ni temporizadores.
 *
 * ```tsx
 * // dentro de una baldosa: el efecto corre 60 cuadros, se queda 24 quieto, se funde y vuelve a empezar; cada baldosa con su desfase
 * <Loop duration={60} pause={24} offset={i * 9}>
 *   <Globe start={0} duration={60} width={W} height={H} />
 * </Loop>
 * ```
 *
 * Adentro, `useFrame()` es el cuadro local (0 al empezar cada vuelta), así que el efecto va con `start={0}` y el mismo `duration`. Los efectos del
 * catálogo no dejan residuos antes de `start` ni al terminar, y `fade` solo emite `opacity` mientras funde (con la `key` cambiando con ella), así que
 * el lazo pasa `--check`. Un efecto con `seed` repite el mismo azar en cada vuelta; para que cada vuelta varíe, pasá `seed={`x${state.index}`}` con
 * la función hija. Regla de los muestrarios: un efecto que se muestra no queda estático (docs/animaciones.md).
 */
export function Loop({ duration, pause, start, offset, mode, fadeOut, fadeIn, fadeFirst, times, frame, style, children }: LoopProps) {
  const ctx = useFrame();
  const f = frame ?? ctx;
  const st = loopState(f, { duration, pause, start, offset, mode, fadeOut, fadeIn, fadeFirst, times });
  const dimmed = fade(st.opacity);
  return (
    <div key={dimmed === undefined ? "pleno" : "fundido"} style={{ position: "relative", width: "100%", height: "100%", ...style, opacity: dimmed }}>
      <Sequence from={ctx - st.local}>{typeof children === "function" ? children(st.local, st) : children}</Sequence>
    </div>
  );
}
