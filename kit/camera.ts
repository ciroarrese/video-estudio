import { bezier } from "../engine";
import { kf } from "./kf";
import { clamp } from "./util";

/** Cuadro clave de cámara: foco (x, y) en coordenadas del mundo y escala. */
export type CameraKey = { f: number; x: number; y: number; scale: number };

/** Estado de cámara en un cuadro. `rx`/`ry` son grados de inclinación; `blur` en px. */
export type Camera = { x: number; y: number; scale: number; rx: number; ry: number; blur: number };

export type CameraOptions = {
  /** Inclinación en reposo (grados). Por defecto 0: cámara quieta = sin inclinación. */
  baseTilt?: { rx: number; ry: number };
  /** Grados de inclinación por px/cuadro de velocidad en pantalla. Por defecto 0.05. */
  tiltGain?: number;
  /** Tope de inclinación (grados). Por defecto 8. */
  maxTilt?: number;
  /** Tope de desenfoque (px). Por defecto 7. */
  maxBlur?: number;
  /** Velocidad (px de pantalla por cuadro) bajo la cual no hay desenfoque. Por defecto 12. */
  blurThreshold?: number;
  /** Cuánta velocidad extra equivale a 1 px de desenfoque. Por defecto 14. */
  blurRange?: number;
  /** Desde este cuadro el desenfoque es 0 (p. ej. en el atravesado final). */
  noBlurFrom?: number;
  /** Transforma la cámara base (p. ej. `zoomThrough`); la velocidad se mide sobre el resultado. */
  map?: (frame: number, cam: { x: number; y: number; scale: number }) => { x: number; y: number; scale: number };
};

function base(frame: number, keys: CameraKey[], map?: CameraOptions["map"]) {
  const t = keys.map((k) => k.f);
  const c = { x: kf(frame, t, keys.map((k) => k.x)), y: kf(frame, t, keys.map((k) => k.y)), scale: kf(frame, t, keys.map((k) => k.scale)) };
  return map ? map(frame, c) : c;
}

/**
 * Cámara por cuadros clave, con inclinación y desenfoque según la velocidad
 * (diferencia con el cuadro anterior; sigue siendo función pura del cuadro).
 * Una sola clave = cámara fija. Los cuadros clave deben ser estrictamente crecientes (si no, lanza).
 */
export function cameraAt(frame: number, keys: CameraKey[], opts: CameraOptions = {}): Camera {
  if (keys.length === 0) throw new Error("cameraAt: se necesita al menos un cuadro clave");
  for (let i = 1; i < keys.length; i++) {
    if (!(keys[i]!.f > keys[i - 1]!.f)) {
      throw new Error(`cameraAt: los cuadros clave deben ser estrictamente crecientes (cuadro ${keys[i - 1]!.f} seguido de ${keys[i]!.f}, posiciones ${i - 1} y ${i})`);
    }
  }
  const { baseTilt = { rx: 0, ry: 0 }, tiltGain = 0.05, maxTilt = 8, maxBlur = 7, blurThreshold = 12, blurRange = 14, noBlurFrom, map } = opts;
  const c = base(frame, keys, map);
  const p = base(frame - 1, keys, map);
  const vx = (c.x - p.x) * c.scale;
  const vy = (c.y - p.y) * c.scale;
  const speed = Math.hypot(vx, vy);
  const blur = noBlurFrom !== undefined && frame >= noBlurFrom ? 0 : clamp((speed - blurThreshold) / blurRange, 0, maxBlur);
  return {
    ...c,
    rx: baseTilt.rx + clamp(vy * tiltGain, -maxTilt, maxTilt),
    ry: baseTilt.ry - clamp(vx * tiltGain, -maxTilt, maxTilt),
    blur,
  };
}

/**
 * Convierte una cámara en un atravesado de `target`: entre `start` y `end` el foco se
 * desliza al objetivo y la escala se multiplica por `power ** p` (p con curva de aceleración).
 * Antes de `start` devuelve la cámara intacta. Con `start === end` es un salto (escalón).
 */
export function zoomThrough(
  frame: number,
  [start, end]: [number, number],
  cam: { x: number; y: number; scale: number },
  target: { x: number; y: number },
  power = 70,
): { x: number; y: number; scale: number } {
  const p = end > start ? kf(frame, [start, end], [0, 1], bezier(0.7, 0, 0.84, 0)) : frame >= start ? 1 : 0;
  if (p <= 0) return cam;
  const slide = Math.max(1, Math.min(12, (end - start) / 3));
  return {
    x: kf(frame, [start, start + slide], [cam.x, target.x]),
    y: kf(frame, [start, start + slide], [cam.y, target.y]),
    scale: cam.scale * Math.pow(power, p),
  };
}
