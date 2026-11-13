import { createContext, useContext } from "react";
import { DockedHeadline } from "../kit";
import { fitText } from "./layout";

export type TopicInfo = { index: number; name: string; line: string };

export const TopicContext = createContext<TopicInfo | null>(null);

/**
 * Tema que se está mostrando (`index` desde 0): lo da la historia armada por `composeStory`.
 * Una escena renderizada SOLA (fuera de la historia) no tiene tema: pasá un `fallback` (p. ej. `{ name: "Panel de ventas" }`) y
 * lo usa, completando `index` en 0 y `line` vacía. Sin `fallback` fuera de una historia lanza un error que dice cómo resolverlo.
 */
export function useTopic(fallback?: Partial<TopicInfo>): TopicInfo {
  const t = useContext(TopicContext);
  if (t) return t;
  if (fallback) return { index: 0, name: "", line: "", ...fallback };
  throw new Error("useTopic: no hay tema fuera de una historia (composeStory). Para renderizar la escena sola, usá useTopic({ name: \"...\" }) o <TopicHeadline title=\"...\" />");
}

/** Igual que `useTopic` pero devuelve null fuera de una historia (no lanza). */
export const useTopicOrNull = (): TopicInfo | null => useContext(TopicContext);

const warned = new Set<string>();
/** Aviso de desarrollo, una sola vez por mensaje (no cambia lo que se dibuja: el cuadro sigue siendo función pura de sus props). */
function warnOnce(msg: string) {
  if (warned.has(msg)) return;
  warned.add(msg);
  if (typeof console !== "undefined") console.warn(msg);
}

/**
 * Titular del tema (píldora arriba a la izquierda) ya armado con el nombre y la línea del tema.
 * La escena decide cuándo mostrarlo (`start`) y cuándo apartarlo (`hide`, 0..1, p. ej. `hideFromScale(cam.scale)`).
 *
 * Fuera de una historia (escena renderizada sola) no hay tema: usa `title` y `number` (1 por defecto) si los pasás; si no pasás
 * `title`, no dibuja nada y avisa una vez en la consola. Dentro de una historia, `title`/`number` pisan al tema.
 */
export function TopicHeadline({ start = 0, hide = 0, frame, title, number }: { start?: number; hide?: number; frame?: number; title?: string; number?: number }) {
  const t = useTopicOrNull();
  const name = title ?? t?.name;
  if (name === undefined) {
    warnOnce("TopicHeadline: no hay tema (la escena se renderiza fuera de una historia) y falta la prop `title`; no se dibuja el titular. Pasá title=\"...\" para verla sola.");
    return null;
  }
  return <DockedHeadline index={number ?? (t ? t.index + 1 : 1)} title={fitText(name, 760, 32, { min: 22 }).text} start={start} hide={hide} frame={frame} />;
}
