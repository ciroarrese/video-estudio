import type { ComponentType } from 'react';
import type { VideoConfig } from './config';

export type VideoDefinition<P = Record<string, unknown>> = VideoConfig & {
  id: string;
  component: ComponentType<P>;
  defaultProps?: P;
};

const registry = new Map<string, VideoDefinition<any>>();

/** Register a video. Re-registering the same id replaces it (keeps HMR working). */
export function defineVideo<P = Record<string, unknown>>(def: VideoDefinition<P>): VideoDefinition<P> {
  if (!def.id) throw new Error('defineVideo: id is required');
  for (const k of ['width', 'height', 'durationInFrames'] as const) {
    if (!Number.isInteger(def[k]) || def[k] <= 0) throw new Error(`defineVideo(${def.id}): ${k} tiene que ser un entero positivo (recibido ${String(def[k])})`);
  }
  if (!Number.isFinite(def.fps) || def.fps <= 0) throw new Error(`defineVideo(${def.id}): fps tiene que ser un número positivo (recibido ${String(def.fps)})`);
  registry.set(def.id, def);
  return def;
}

export function getVideos(): VideoDefinition<any>[] {
  return [...registry.values()];
}

export function getVideo(id: string): VideoDefinition<any> | undefined {
  return registry.get(id);
}
