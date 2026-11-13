import type { ComponentType } from 'react';
import type { VideoConfig } from './config';
import { resolveFormats, type FormatName, type FormatSize, type FormatsOption } from './format';
import type { SceneInfo } from './scenes';

export type VideoDefinition<P = Record<string, unknown>> = Omit<VideoConfig, 'format'> & {
  id: string;
  component: ComponentType<P>;
  defaultProps?: P;
  /**
   * Formatos que admite el video además del base (`width` x `height`): una lista (`['vertical', 'cuadrado']`, con tamaños
   * derivados: 1920x1080 da 1080x1920 y 1080x1080) o un objeto con el tamaño de cada uno. Se eligen con `--format` o `&format=`.
   */
  formats?: FormatsOption;
  /** Escenas del video (id, nombre y rango de cuadros), si se conocen de antemano; si no, salen de `<Sequence name>`. */
  scenes?: SceneInfo[];
};

/** Lo que guarda el registro: la definición más los tamaños de formato ya resueltos y de qué carpeta salió. */
export type RegisteredVideo<P = Record<string, unknown>> = VideoDefinition<P> & {
  formatSizes?: Partial<Record<FormatName, FormatSize>>;
  /** Carpeta del video (`videos/<slug>`, `examples/<id>`) cuando lo cargó el runtime; vacío si se registró a mano. */
  source?: string;
};

/** Error del registro (id repetido, etc.): el runtime lo muestra tal cual. */
export class VideoRegistryError extends Error {}

const registry = new Map<string, RegisteredVideo<any>>();
let currentSource: string | null = null;

/** El runtime lo usa mientras carga la carpeta de un video, para decir de dónde salió cada `id`. */
export function setVideoSource(source: string | null): void {
  currentSource = source;
}

/** Vacía el registro (pruebas). */
export function clearVideos(): void {
  registry.clear();
}

/**
 * Register a video. Re-registering the same id replaces it (keeps HMR working), pero si el id lo usan dos carpetas
 * distintas (el runtime las carga con `setVideoSource`) lanza un error que nombra las dos.
 */
export function defineVideo<P = Record<string, unknown>>(def: VideoDefinition<P>): RegisteredVideo<P> {
  if (!def.id) throw new Error('defineVideo: id is required');
  for (const k of ['width', 'height', 'durationInFrames'] as const) {
    if (!Number.isInteger(def[k]) || def[k] <= 0) throw new Error(`defineVideo(${def.id}): ${k} tiene que ser un entero positivo (recibido ${String(def[k])})`);
  }
  if (!Number.isFinite(def.fps) || def.fps <= 0) throw new Error(`defineVideo(${def.id}): fps tiene que ser un número positivo (recibido ${String(def.fps)})`);
  const formatSizes = resolveFormats(def.id, def.width, def.height, def.formats);
  for (const s of def.scenes ?? []) {
    if (!s.id || !Number.isInteger(s.from) || s.from < 0 || !Number.isInteger(s.durationInFrames) || s.durationInFrames <= 0) {
      throw new Error(`defineVideo(${def.id}): cada escena necesita id, from (entero >= 0) y durationInFrames (entero > 0)`);
    }
  }
  const prev = registry.get(def.id);
  if (prev?.source && currentSource && prev.source !== currentSource) {
    throw new VideoRegistryError(`Hay dos videos con el id "${def.id}": ${prev.source} y ${currentSource}. Cambiá el id de uno de los dos (cada video necesita un id único).`);
  }
  const reg: RegisteredVideo<P> = { ...def, formatSizes, ...(currentSource ? { source: currentSource } : {}) };
  registry.set(def.id, reg);
  return reg;
}

export function getVideos(): RegisteredVideo<any>[] {
  return [...registry.values()];
}

export function getVideo(id: string): RegisteredVideo<any> | undefined {
  return registry.get(id);
}
