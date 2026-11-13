import type { Stage } from './stage';

/** Una escena nombrada de un video: rango de cuadros absolutos [from, from + durationInFrames). */
export type SceneInfo = {
  id: string;
  /** Texto para mostrar (por ejemplo el nombre del tema); si falta se muestra el id. */
  name?: string;
  from: number;
  durationInFrames: number;
};

const found = new Map<string, SceneInfo>();

/** Lo llama `<Sequence name>` al dibujarse (idempotente: la clave es el valor). */
export function registerScene(s: SceneInfo): void {
  found.set(`${s.id}|${s.from}|${s.durationInFrames}`, s);
}
export const clearScenes = () => found.clear();

/** Escenas registradas hasta ahora, en orden de aparición (y de lo más externo a lo más anidado). */
export const collectScenes = (): SceneInfo[] => [...found.values()].sort((a, b) => a.from - b.from || b.durationInFrames - a.durationInFrames);

const cache = new WeakMap<Stage, SceneInfo[]>();

/**
 * Escenas del video: las declaradas en `defineVideo({ scenes })` o, si no hay, las `<Sequence name>` / `<Series.Item name>`
 * que aparecen al dibujar todos los cuadros una vez (como `scanAudio`; se guarda en cache y se vuelve al cuadro que se veía).
 */
export function resolveScenes(stage: Stage): SceneInfo[] {
  if (stage.def.scenes) return [...stage.def.scenes].sort((a, b) => a.from - b.from);
  const hit = cache.get(stage);
  if (hit) return hit;
  const prev = stage.current();
  stage.blank();
  clearScenes();
  const total = stage.def.durationInFrames;
  for (let n = 0; n < total; n++) stage.render(n);
  const res = collectScenes().map((s) => ({ ...s, durationInFrames: Math.min(s.durationInFrames, total - s.from) }));
  clearScenes();
  cache.set(stage, res);
  stage.blank();
  if (prev !== null) stage.render(prev);
  return res;
}
