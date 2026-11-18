import type { Stage } from './stage';

/**
 * Un sonido de una escena. `frame` es RELATIVO al inicio de la escena (0 = primer cuadro de la escena): lo normal es derivarlo de la tabla
 * de tiempos de la propia escena, así que si la escena cambia de lugar o de duración el sonido la sigue. `npm run audio -- mezcla --video <id>`
 * lo suma al `from` de la escena. Es el mismo formato que un cue de `--cues` (`sfx`, `gain`, `ancla`).
 */
export type SceneCue = { frame: number; sfx: string; gain?: number; ancla?: 'inicio' | 'pico' };

/**
 * Audio propio de una escena (una locución, un efecto incrustado, una música que trae la escena): `true` es toda la escena; `{ desde, hasta }`
 * un tramo en cuadros relativos a la escena (`hasta` excluido). `audio` (mezcla, empalme, informe) lo usa para terminar o bajar la música antes.
 */
export type SceneOwnAudio = boolean | { desde?: number; hasta?: number };

/** Una escena nombrada de un video: rango de cuadros absolutos [from, from + durationInFrames). */
export type SceneInfo = {
  id: string;
  /** Texto para mostrar (por ejemplo el nombre del tema); si falta se muestra el id. */
  name?: string;
  from: number;
  durationInFrames: number;
  /** Sonidos de la escena en cuadros relativos a ella (ver `SceneCue`); opcional. */
  cues?: SceneCue[];
  /** La escena trae audio propio (ver `SceneOwnAudio`); opcional. */
  audioPropio?: SceneOwnAudio;
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
