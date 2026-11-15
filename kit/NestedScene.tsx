import React, { useContext, useMemo } from "react";
import { deriveFormatSizes } from "../engine";
import type { FormatName } from "../engine";
import { ConfigContext, TimeContext } from "../engine/context";

/**
 * Una escena completa mostrada chica dentro de otra (una vista previa, una miniatura viva, la "pantalla" de un estudio): la escena se dibuja a su
 * tamaño natural (1920 x 1080, o el del `format` que se pida) y el contenedor la achica con una sola `scale()`. Es la receta de `docs/guia-escenas.md`,
 * "Una escena dentro de otra": acá está resuelta una vez, con lo que hay que cuidar para que pase `--check`.
 *
 * ```tsx
 * <NestedScene scene={Intro} start={120} width={640} style={{ position: "absolute", left: 80, top: 200 }} />
 * <NestedScene scene={Intro} format="vertical" height={560} frame={90} />   // cuadro fijo (una miniatura), en vertical
 * ```
 *
 * Qué hace por vos:
 * - **Cuadro local**: la escena ve `useFrame()` desde 0 en `start` (o fijo en `frame`), como si fuera su propio video. Si tiene `Sequence` con nombre, se
 *   registran con su cuadro absoluto correcto.
 * - **Formato**: `FrameProvider` con otra `config` (`format`: `horizontal`, `vertical` o `cuadrado`, o `size`), así `useFormat()` y `useVideoConfig()` de la
 *   escena de adentro dicen la verdad aunque el video de afuera sea de otro formato. Sin `format` ni `size`, el del video de afuera.
 * - **Escala**: `scale` directo, o `width` y/o `height` en pantalla (entra completa, sin deformar; sobra lugar en un lado si las proporciones no coinciden).
 *   La posición y el tamaño del contenedor son enteros y la escala se redondea a 4 decimales: lo que `--check` necesita.
 * - **Texto**: `text-rendering: geometricPrecision` en la escena de adentro. Sin él, Chromium elige el suavizado del texto según el historial de cuadros
 *   y el mismo cuadro sale distinto bajo una escala (el residuo clásico de "texto bajo `scale()`", `docs/reglas.md`).
 * - **`qa`**: el contenedor lleva `data-qa-decor` (el texto de una reproducción chica no se juzga con `min-size` ni `contrast`; `clip` y `overlap` sí) y
 *   `data-qa-fixed-scale` (queda fuera del estrés de tipografía). Con `qa={false}` no lleva ninguna: usalo si la vista previa es grande y su texto tiene que leerse.
 *
 * Limites: el audio de la escena de adentro (`Audio`) se registra como el de cualquier otra y suena en el video; si no lo querés, no uses `Audio` en una escena que
 * se va a anidar. La escena de adentro usa su propio `ThemeProvider` (o el del video de afuera, si no declara uno). No anidés una escena que usa `World` con cámara
 * en movimiento fuerte dentro de otra con zoom (escalas pesadas anidadas, `docs/reglas.md`): hacé el zoom con la cámara de afuera.
 */
export function NestedScene({
  scene: Scene,
  sceneProps,
  start = 0,
  frame,
  format,
  size,
  scale,
  width,
  height,
  qa = true,
  style,
}: {
  /** El componente de la escena (el mismo que usarías como `component` de `defineVideo`). */
  scene: React.ComponentType<any>;
  sceneProps?: Record<string, unknown>;
  /** Cuadro del video de afuera en que la escena de adentro está en su cuadro 0 (por defecto 0). */
  start?: number;
  /** Cuadro local fijo de la escena de adentro (una miniatura quieta): pisa a `start`. */
  frame?: number;
  /** Formato en que se dibuja la escena de adentro (por defecto el del video de afuera). */
  format?: FormatName;
  /** Tamaño natural explícito de la escena de adentro (pisa a `format`). */
  size?: { width: number; height: number };
  /** Escala directa (0,1 = una décima del tamaño natural). Si falta, sale de `width` y/o `height`. */
  scale?: number;
  /** Ancho / alto que ocupa en pantalla (px). Entra completa sin deformarse. */
  width?: number;
  height?: number;
  qa?: boolean;
  /** Para ubicar el contenedor (por ejemplo `position: "absolute", left, top`). Por defecto es `position: relative`. */
  style?: React.CSSProperties;
}) {
  const time = useContext(TimeContext);
  const cfg = useContext(ConfigContext);
  if (!time || !cfg) throw new Error("<NestedScene> tiene que estar dentro de <FrameProvider>");
  const nat = size ?? (format ? deriveFormatSizes(cfg.width, cfg.height)[format] : { width: cfg.width, height: cfg.height });
  const k0 = scale ?? Math.min(width !== undefined ? width / nat.width : Infinity, height !== undefined ? height / nat.height : Infinity);
  if (!Number.isFinite(k0) || k0 <= 0) throw new Error("<NestedScene> necesita `scale`, `width` o `height`");
  const k = +k0.toFixed(4);
  const outW = Math.round(width ?? nat.width * k), outH = Math.round(height ?? nat.height * k);
  // la escena queda centrada en el contenedor: posiciones enteras (con `left`/`top` fraccionarios la captura depende del historial)
  const offX = Math.round((outW - nat.width * k) / 2), offY = Math.round((outH - nat.height * k) / 2);
  const local = frame ?? Math.max(0, time.frame - start);
  const inner = useMemo(
    () => ({
      time: { frame: local, offset: time.offset + (frame === undefined ? start : time.frame - local), end: time.end },
      config: { ...cfg, width: nat.width, height: nat.height, format: format ?? cfg.format },
    }),
    [local, time.offset, time.end, time.frame, start, frame, cfg, nat.width, nat.height, format],
  );
  const marks = qa ? { "data-qa-decor": "", "data-qa-fixed-scale": "" } : {};
  return (
    <div {...marks} style={{ position: "relative", width: outW, height: outH, overflow: "hidden", ...style }}>
      <div
        style={{
          position: "absolute", left: offX, top: offY, width: nat.width, height: nat.height, overflow: "hidden", transformOrigin: "0 0",
          // `scale(1)` no se emite: en reposo (escala 1) no queda una capa propia que Chromium rasterice distinto
          transform: k === 1 ? undefined : `scale(${k})`, textRendering: "geometricPrecision",
        }}
      >
        <ConfigContext.Provider value={inner.config}>
          <TimeContext.Provider value={inner.time}>
            <Scene {...(sceneProps ?? {})} />
          </TimeContext.Provider>
        </ConfigContext.Provider>
      </div>
    </div>
  );
}
