import type { CameraKey } from "./camera";
import type { Rect } from "./layout";

/** Cuadros después del inicio de una señal en que la cámara llega al objetivo (por defecto). */
export const GUIDED_ARRIVE = 14;
/** Cuadros que dura el viaje de un objetivo al siguiente (por defecto). */
export const GUIDED_TRAVEL = 22;

/** Una señal sobre algo del mundo: un rectángulo, cuándo empieza y cuánto dura. */
export type FocusSignal = {
  /** Nombre de la señal (para mensajes de error y para `qa`); por defecto `senal-<posición>`. */
  id?: string;
  /** Lo que se señala, en coordenadas del mundo. */
  target: Rect;
  /** Cuadro en que empieza la señal. */
  start: number;
  /** Cuadros que dura. */
  duration: number;
  /** Escala propia para este objetivo (gana sobre el límite por tamaño). */
  scale?: number;
  /** Cuadros después de `start` en que la cámara llega (por defecto `arrive` de las opciones). */
  arrive?: number;
};

/** Una parada a mano: un encuadre que no es una señal (la cámara llega en el cuadro `f`). */
export type CameraStop = { f: number; x: number; y: number; scale: number; id?: string };

export type GuidedCameraOptions = {
  /** Vista general: el foco y la escala de arranque (por defecto escala 1). Es también adonde vuelve la cámara con `returnAt`. */
  overview: { x: number; y: number; scale?: number };
  /**
   * Rango de zoom. `in` es el acercamiento de cada objetivo. `out` es lo más alejado que se permite al limitar el zoom por tamaño
   * (por defecto, la escala de la vista general): con un objetivo más grande que el área útil la escala baja de `in` hasta que entra, pero nunca de `out`.
   */
  zoom: { in: number; out?: number };
  /** Señales, en cualquier orden (se ordenan por cuadro de llegada). */
  signals: FocusSignal[];
  /** Paradas a mano, mezcladas con las señales por cuadro. */
  stops?: CameraStop[];
  /** Tamaño del cuadro (el del formato): `useFormat()`. */
  format: { width: number; height: number };
  /** Margen del área útil al borde del cuadro, en px de pantalla. Por defecto 80. */
  margin?: number;
  /** Área útil en pantalla (si no es el cuadro menos el margen). El objetivo se centra en el centro del cuadro: entra si cabe en lo que queda a cada lado. */
  safe?: Rect;
  /** Aire alrededor del objetivo para el foco dibujado, en px del mundo. Por defecto 16. */
  targetPad?: number;
  /** Cuadros después del inicio de la señal en que la cámara llega (por defecto 14). */
  arrive?: number;
  /** Cuadros de viaje entre objetivos (por defecto 22; si no hay tanto tiempo entre dos paradas, el viaje se acorta). */
  travel?: number;
  /** Cuadro en que la cámara vuelve a estar en la vista general (sale `travel` cuadros antes). Sin él, se queda en el último objetivo. */
  returnAt?: number;
};

/** Una parada de la cámara en el plan: dónde, desde cuándo y hasta cuándo. */
export type GuidedStop = {
  id: string;
  kind: "signal" | "stop" | "overview";
  /** Índice en `signals` (solo `signal`). */
  signal?: number;
  /** Cuadro en que la cámara llega. */
  arrive: number;
  /** Cuadro en que sale hacia la parada siguiente (`Infinity` si es la última y se queda). */
  depart: number;
  /** Cámara asentada en esta parada. */
  key: { x: number; y: number; scale: number };
  /** `false` si el objetivo no entra en el área útil ni a la escala más alejada permitida (hay que achicarlo o ampliar el área). */
  fits: boolean;
};

export type GuidedPlan = { keys: CameraKey[]; stops: GuidedStop[] };

/** Escala a la que un objetivo centrado en el cuadro entra en el área útil (con `pad` de aire): la menor de ancho y alto. */
export function fitScale(target: Rect, format: { width: number; height: number }, safe: Rect, pad = 0): number {
  const cx = format.width / 2, cy = format.height / 2;
  const halfW = Math.min(cx - safe.x, safe.x + safe.w - cx);
  const halfH = Math.min(cy - safe.y, safe.y + safe.h - cy);
  return Math.min((2 * halfW) / (target.w + 2 * pad), (2 * halfH) / (target.h + 2 * pad));
}

/**
 * Plan de una cámara guiada por focos: una función pura de sus opciones (sin tema ni cuadro). Devuelve las claves para `cameraAt`/`useCameraAt`
 * y las paradas (`GuidedStop`) para saber dónde y cuándo está asentada.
 *
 * - Arranca en la vista general. El **acercamiento** es el viaje de ahí al primer objetivo; después, cada objetivo queda **centrado** en el cuadro.
 * - La cámara llega `arrive` cuadros después del inicio de cada señal (14) y viaja en `travel` cuadros (22): sale `travel` cuadros antes de llegar y
 *   hasta entonces sostiene la parada anterior. Si no hay tanto tiempo desde la parada anterior, sale en cuanto llegó (viaje más corto).
 * - La escala es `zoom.in`; solo se limita si el objetivo (con `targetPad`) no entra en el área útil a esa escala: baja hasta que entra, sin pasar de `zoom.out`.
 * - `stops` suma encuadres a mano (llegan en su cuadro `f`); `returnAt` devuelve la cámara a la vista general.
 * Lanza un error en español si dos paradas llegan en el mismo cuadro o si una señal no tiene duración.
 */
export function guidedCameraPlan(o: GuidedCameraOptions): GuidedPlan {
  const arriveDefault = o.arrive ?? GUIDED_ARRIVE;
  const travel = Math.max(1, Math.round(o.travel ?? GUIDED_TRAVEL));
  const ov = { x: o.overview.x, y: o.overview.y, scale: o.overview.scale ?? 1 };
  const zin = o.zoom.in;
  const zout = o.zoom.out ?? ov.scale;
  const m = o.margin ?? 80;
  const safe = o.safe ?? { x: m, y: m, w: o.format.width - 2 * m, h: o.format.height - 2 * m };
  const pad = o.targetPad ?? 16;

  type Way = Omit<GuidedStop, "depart">;
  const ways: Way[] = [];
  o.signals.forEach((s, i) => {
    const id = s.id ?? `senal-${i + 1}`;
    if (!(s.duration > 0)) throw new Error(`guidedCameraPlan: la señal "${id}" tiene que durar más de 0 cuadros (duration ${s.duration})`);
    const fit = fitScale(s.target, o.format, safe, pad);
    const scale = s.scale ?? (zin <= fit ? zin : Math.max(fit, zout));
    ways.push({
      id, kind: "signal", signal: i, arrive: Math.round(s.start + (s.arrive ?? arriveDefault)),
      key: { x: s.target.x + s.target.w / 2, y: s.target.y + s.target.h / 2, scale }, fits: scale <= fit + 1e-9,
    });
  });
  (o.stops ?? []).forEach((s, i) => ways.push({ id: s.id ?? `parada-${i + 1}`, kind: "stop", arrive: Math.round(s.f), key: { x: s.x, y: s.y, scale: s.scale }, fits: true }));
  if (o.returnAt !== undefined) ways.push({ id: "vista-general", kind: "overview", arrive: Math.round(o.returnAt), key: ov, fits: true });
  ways.sort((a, b) => a.arrive - b.arrive);

  const keys: CameraKey[] = [{ f: 0, ...ov }];
  const stops: GuidedStop[] = [];
  for (const w of ways) {
    const last = keys[keys.length - 1]!;
    if (w.arrive <= 0 && keys.length === 1) {
      // llega en el cuadro 0: la cámara ya arranca ahí (no hay acercamiento que mostrar)
      keys[0] = { f: 0, ...w.key };
      stops.push({ ...w, arrive: 0, depart: Infinity });
      continue;
    }
    if (w.arrive <= last.f) {
      const prev = stops[stops.length - 1];
      throw new Error(`guidedCameraPlan: "${w.id}" llega en el cuadro ${w.arrive}, pero la parada anterior${prev ? ` ("${prev.id}")` : ""} ya llegó en el ${last.f}; separá las señales (la cámara necesita al menos un cuadro de viaje entre una y otra).`);
    }
    const dep = w.arrive - travel;
    let departAt = last.f;
    if (dep > last.f) {
      keys.push({ f: dep, x: last.x, y: last.y, scale: last.scale }); // sostiene la parada anterior hasta salir
      departAt = dep;
    }
    const prev = stops[stops.length - 1];
    if (prev) prev.depart = departAt;
    keys.push({ f: w.arrive, ...w.key });
    stops.push({ ...w, depart: Infinity });
  }
  return { keys, stops };
}

/** Solo las claves de `guidedCameraPlan`, listas para `cameraAt(frame, keys, { profile: "plana" })` o `useCameraAt`. */
export function guidedCameraKeys(o: GuidedCameraOptions): CameraKey[] {
  return guidedCameraPlan(o).keys;
}

/**
 * La parada de señal sobre la que está asentada la cámara en `frame` (llegó y todavía no salió hacia la siguiente), o `undefined` si viaja,
 * está en la vista general o en una parada a mano. Es lo que el marco de paso marca con `data-qa-settled`.
 */
export function guidedSettledAt(plan: GuidedPlan, frame: number): GuidedStop | undefined {
  return plan.stops.find((s) => s.kind === "signal" && frame >= s.arrive && frame <= s.depart);
}
