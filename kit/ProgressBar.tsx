import { useFormat } from "../engine";
import { useTheme } from "../themes";
import { clamp } from "./util";

/** Progreso total (0 a 1) de una barra única: el paso en que se está más el avance dentro del paso, sobre la cantidad de pasos. */
export function stepProgress(step: number, steps: number, within = 0): number {
  if (!(steps > 0)) return 0;
  return clamp((step + clamp(within, 0, 1)) / steps, 0, 1);
}

/**
 * Barra de progreso **única** de un tutorial: una raya fina arriba del cuadro, sin fondo ni rótulo, del color de acento del tema. Avanza con el paso y con
 * el avance dentro del paso (`step + progress` sobre `steps`), sin una barra por etapa ni un "Paso N de M". Es una capa fija en espacio de pantalla
 * (va fuera de `World`) y lleva `data-qa-overlay="progreso"` (no está anclada a ningún objetivo: queda fija en la pantalla mientras la cámara se mueve). Ancho y alto en px enteros; antes del primer avance no dibuja nada.
 *
 * ```tsx
 * <ProgressBar step={1} steps={4} progress={frame / DURACION_DEL_PASO} />
 * ```
 */
export function ProgressBar({ step, steps, progress = 0, thickness }: {
  /** Paso actual, desde 0. */
  step: number;
  /** Cantidad de pasos. */
  steps: number;
  /** Avance dentro del paso, de 0 a 1. */
  progress?: number;
  /** Alto en px (por defecto un 0,37 % del alto del cuadro: 4 px en 1080). */
  thickness?: number;
}) {
  const theme = useTheme();
  const { width, height } = useFormat();
  const w = Math.round(stepProgress(step, steps, progress) * width);
  if (w <= 0) return null;
  const h = thickness ?? Math.max(2, Math.round(height / 270));
  return (
    <div
      data-qa-overlay="progreso"
      style={{ position: "absolute", left: 0, top: 0, width: w, height: h, background: theme.color.accent, zIndex: 90, pointerEvents: "none" }}
    />
  );
}
