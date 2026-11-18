import { cameraOptions, useTheme } from "../themes";
import { cameraAt, resolveCameraProfile } from "./camera";
import type { Camera, CameraKey, CameraOptions } from "./camera";

/**
 * `cameraAt` con los valores por defecto del design system (`style.motion.cameraBlur` y `cameraTilt`, por `cameraOptions(theme)`):
 * sin desenfoque en el recorrido o con más o menos inclinación según el tema. Lo que se pasa en `opts` siempre gana
 * (por ejemplo `maxBlur: 3` o `tiltGain: 0` explícitos). Con el estilo por defecto da exactamente lo mismo que `cameraAt`.
 * Con `opts.profile` (por ejemplo `"plana"`) el perfil va encima de lo que pide el tema y debajo de lo explícito: una cámara `plana` no se inclina aunque el tema lo pida.
 * Es un hook solo porque lee el tema: sigue siendo una función pura del cuadro.
 */
export function useCameraAt(frame: number, keys: CameraKey[], opts: CameraOptions = {}): Camera {
  const theme = useTheme();
  // tema < perfil < lo explícito (el perfil pisa lo que pide el tema)
  const { profile, ...rest } = opts;
  const prof = profile ? resolveCameraProfile({ profile }) : {};
  return cameraAt(frame, keys, { ...cameraOptions(theme), ...prof, ...rest });
}
