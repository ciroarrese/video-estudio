import { cameraOptions, useTheme } from "../themes";
import { cameraAt } from "./camera";
import type { Camera, CameraKey, CameraOptions } from "./camera";

/**
 * `cameraAt` con los valores por defecto del design system (`style.motion.cameraBlur` y `cameraTilt`, por `cameraOptions(theme)`):
 * sin desenfoque en el recorrido o con más o menos inclinación según el tema. Lo que se pasa en `opts` siempre gana
 * (por ejemplo `maxBlur: 3` o `tiltGain: 0` explícitos). Con el estilo por defecto da exactamente lo mismo que `cameraAt`.
 * Es un hook solo porque lee el tema: sigue siendo una función pura del cuadro.
 */
export function useCameraAt(frame: number, keys: CameraKey[], opts: CameraOptions = {}): Camera {
  const theme = useTheme();
  return cameraAt(frame, keys, { ...cameraOptions(theme), ...opts });
}
