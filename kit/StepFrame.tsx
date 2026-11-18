import React from "react";
import { useFormat } from "../engine";
import { useTheme } from "../themes";
import type { AnnotationMarkSetting } from "../themes";
import { Callout, calloutDecision } from "./Callout";
import { DataCard, dataCardDecision } from "./DataCard";
import { World } from "./World";
import { guidedCameraPlan, guidedSettledAt } from "./guidedCamera";
import type { CameraStop, FocusSignal, GuidedCameraOptions } from "./guidedCamera";
import { projectRect } from "./project";
import { ProgressBar } from "./ProgressBar";
import { useCameraAt } from "./useCameraAt";
import type { CameraProfileName } from "./camera";
import type { Rect, Side } from "./layout";
import { useFrameOr } from "./util";

/** Una señal del marco de paso: lo que se señala, cuándo y qué se escribe junto al foco. */
export type StepSignal = FocusSignal & {
  /** Etiqueta junto al foco (una línea). Lado y alineación se deciden una sola vez, con la cámara asentada. */
  label?: string;
  /** Fuerza el lado de la etiqueta (la alineación se decide igual); sin él, el primero libre. */
  labelSide?: Side;
  /** Tarjeta de dato ampliado: rótulo y valor grande del lado indicado. */
  card?: { label: string; value: string; side: Side };
  /** Fuerza otra señal que la del design system (la excepción explícita de `Callout`). */
  variant?: AnnotationMarkSetting;
};

export type StepFrameProps = Omit<GuidedCameraOptions, "signals" | "format" | "stops"> & {
  /** Señales del paso (cuadros locales: el marco lee el cuadro del contexto, así que dentro de un `Sequence` son relativos al paso). */
  signals: StepSignal[];
  /** Paradas a mano de la cámara (encuadres que no son señales). */
  stops?: CameraStop[];
  /** Barra de progreso única: paso actual (desde 0), cantidad de pasos y duración del paso en cuadros. Sin esto no se dibuja. */
  step?: { index: number; count: number; duration: number };
  /** Perfil de la cámara (por defecto `plana`: sin inclinación ni desenfoque, que es lo que pide un recorrido de interfaz). */
  profile?: CameraProfileName;
  /** Rectángulos de pantalla que las etiquetas y tarjetas no deben tapar (por ejemplo `headlineStrip`). */
  keepClear?: Rect[];
  /** Cuadro explícito (por defecto el del motor). */
  frame?: number;
  /** El mundo: la interfaz recreada, en coordenadas del mundo (la cámara la mueve). */
  children?: React.ReactNode;
  /** Capas fijas extra, en espacio de pantalla (por ejemplo el titular). Van encima de todo. */
  overlay?: React.ReactNode;
};

const rnd = (r: Rect): Rect => {
  const x = Math.round(r.x), y = Math.round(r.y);
  return { x, y, w: Math.round(r.x + r.w) - x, h: Math.round(r.y + r.h) - y };
};

/**
 * Marco de paso de un tutorial de interfaz. Recibe la cámara (vista general, rango de zoom, tiempos) y la lista de señales, y dibuja todo lo que
 * acompaña: la cámara guiada (`guidedCameraPlan`, perfil `plana`), el foco y la etiqueta junto a lo señalado (`Callout`), la tarjeta de dato
 * ampliado (`DataCard`) y la barra de progreso (`ProgressBar`). La escena solo declara tiempos y señales; lo que se mueve con la cámara
 * (la interfaz) va de hijo.
 *
 * - El foco, la etiqueta y la tarjeta son capas fijas en espacio de pantalla (`data-qa-overlay`) ancladas al rectángulo **proyectado** con la cámara
 *   de ese mismo cuadro (`projectRect`): no quedan desfasadas durante el viaje.
 * - Lado y alineación de la etiqueta y de la tarjeta se deciden **una sola vez**, con el objetivo ya centrado por la cámara de su señal, y después
 *   solo siguen al rectángulo: no saltan de lado mientras la cámara viaja. La tarjeta va primero (lado indicado) y la etiqueta esquiva su lugar.
 * - Marcas para `qa`: `data-qa-world` en el contenedor que mueve la cámara, `data-qa-settled` mientras la cámara está asentada sobre una señal,
 *   `data-qa-target` en un rectángulo transparente sobre el objetivo de la señal activa (dentro del mundo) y `data-qa-overlay` en las capas fijas.
 * - Con la señal `focus` del design system se dibuja el anillo; atenuar lo demás es cosa de la escena (`FocusGroup` sobre lo que no es el objetivo).
 *
 * ```tsx
 * <StepFrame
 *   overview={{ x: width / 2, y: height / 2 }} zoom={{ in: 1.8 }}
 *   step={{ index: 0, count: 2, duration: 150 }}
 *   signals={[{ id: "fecha", target: CAMPO, start: 20, duration: 60, label: "Elegí la fecha", card: { label: "Disponible", value: "12 lugares", side: "below" } }]}
 * >
 *   <Interfaz />
 * </StepFrame>
 * ```
 */
export function StepFrame({ signals, stops, step, profile = "plana", keepClear = [], frame, children, overlay, ...cam }: StepFrameProps) {
  const theme = useTheme();
  const f = useFrameOr(frame);
  const { width, height } = useFormat();
  const format = { width, height };
  const plan = guidedCameraPlan({ ...cam, signals, stops, format });
  const camera = useCameraAt(f, plan.keys, { profile });
  const settled = guidedSettledAt(plan, f);
  // área segura de pantalla: theme.safe es el margen total de cada eje (la mitad por lado)
  const safe: Rect = { x: theme.safe.x / 2, y: theme.safe.y / 2, w: width - theme.safe.x, h: height - theme.safe.y };
  const prog = step ? Math.min(1, Math.max(0, f / Math.max(1, step.duration))) : 0;

  const pieces = signals.map((s, i) => {
    const range: [number, number] = [s.start, s.start + s.duration];
    const active = f >= range[0] && f < range[1];
    const stop = plan.stops.find((p) => p.signal === i)!;
    // decisión única: con la cámara asentada en la señal (la cámara final de esa señal), no cuadro a cuadro
    const final = rnd(projectRect(s.target, stop.key, format));
    const card = s.card ? dataCardDecision(theme, { target: final, label: s.card.label, value: s.card.value, side: s.card.side, within: safe, avoid: keepClear }) : null;
    const cardRect = card ? { x: card.x, y: card.y, w: card.w, h: card.h } : null;
    const labelDecision = s.label
      ? calloutDecision(theme, { target: final, text: s.label, variant: s.variant, within: safe, avoid: [...keepClear, ...(cardRect ? [cardRect] : [])], prefer: s.labelSide ? [s.labelSide] : undefined })
      : null;
    return { s, range, active, final, card, labelDecision };
  });

  return (
    <>
      <World camera={camera} width={width} height={height} settled={!!settled}>
        {children}
        {pieces.map(({ s, active }) =>
          active ? (
            <div
              key={`t-${s.id ?? signals.indexOf(s)}`}
              data-qa-target={s.id ?? `senal-${signals.indexOf(s) + 1}`}
              style={{ position: "absolute", left: s.target.x, top: s.target.y, width: s.target.w, height: s.target.h, pointerEvents: "none" }}
            />
          ) : null,
        )}
      </World>
      {pieces.map(({ s, range, card, labelDecision }, i) => {
        if (f < range[0] - 1 || f > range[1] + 1) return null;
        // el rectángulo del objetivo en pantalla con la cámara de ESTE cuadro (la misma cuenta que World), en enteros
        const r = rnd(projectRect(s.target, camera, format));
        return (
          // el contenedor es solo un origen (0, 0) para las piezas: la marca `data-qa-overlay` la llevan ellas, ancladas al foco
          <div key={`o-${i}`} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "visible", pointerEvents: "none" }}>
            <Callout
              overlay target={r} text={s.label} range={range} variant={s.variant} within={safe} avoid={keepClear}
              fixed={labelDecision ?? undefined}
            />
            {s.card && card ? (
              <DataCard target={r} label={s.card.label} value={s.card.value} range={range} within={safe} avoid={keepClear} fixed={{ side: card.side, align: card.align }} />
            ) : null}
          </div>
        );
      })}
      {step ? <ProgressBar step={step.index} steps={step.count} progress={prog} /> : null}
      {overlay}
    </>
  );
}
