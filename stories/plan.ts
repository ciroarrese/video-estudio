import type { StorySpec, TopicArrival, TopicHandoff } from "./types";

/** Una vuelta al listado de la línea de tiempo y lo que dibuja. */
export type InterludePlan = {
  /** `"reveal"`: la vuelta que revela el tema tardío (`reveal: "late"`); `"lap"`: una vuelta común. */
  kind: "lap" | "reveal";
  /** Temas (índices) cuya tilde se dibuja en esta vuelta, en orden: el de la escena anterior y los que quedaron pendientes por escenas sin vuelta. */
  ticks: number[];
};

/** Lo que `composeStory` decide de la escena de un tema. */
export type ScenePlan = {
  topic: number;
  handoff: TopicHandoff;
  arrival: TopicArrival;
  /** Vuelta que sigue a la escena (null: ninguna). */
  interlude: InterludePlan | null;
};

/** La escena del tema `j` sigue directo a la anterior (sin vuelta entre las dos). */
export const continuesIntoScene = (spec: StorySpec, j: number): boolean => spec.topics[j]?.reveal === "late" || spec.topics[j]?.interludeBefore === false;

/**
 * Plan de las escenas: para cada tema con escena (en orden), cómo llega, cómo sale y si tiene vuelta después. Lo usan `composeStory`,
 * `storyBudget` y `storyCues`, para que los tres cuenten lo mismo. `hasScene[i]` dice si el tema `i` tiene escena.
 *
 * Reglas: una escena entra desde la apertura (la primera), desde una vuelta o continuando la escena anterior (`interludeBefore: false`, o tema
 * tardío); sale a una vuelta, a la escena que sigue (sin vuelta de por medio) o al cierre. La vuelta de un tema tardío es la revelación.
 */
export function planScenes(spec: StorySpec, hasScene: boolean[], interludes: boolean | "compact" = true): ScenePlan[] {
  const idx = hasScene.flatMap((h, i) => (h ? [i] : []));
  const out: ScenePlan[] = [];
  let pending: number[] = []; // temas ya vistos cuya tilde espera una vuelta
  idx.forEach((i, k) => {
    const next = idx[k + 1];
    const late = spec.topics[i]?.reveal === "late";
    const hasAfter = !!interludes && (next === undefined || !continuesIntoScene(spec, next));
    const arrival: TopicArrival = k === 0 ? "opening" : !!interludes && !continuesIntoScene(spec, i) ? "list" : "previous-scene";
    const handoff: TopicHandoff = hasAfter ? "list" : next !== undefined ? "next-scene" : "closing";
    if (!late) pending.push(i);
    let interlude: InterludePlan | null = null;
    if (hasAfter) {
      interlude = { kind: late ? "reveal" : "lap", ticks: [...pending] };
      pending = [];
    }
    out.push({ topic: i, handoff, arrival, interlude });
  });
  return out;
}
