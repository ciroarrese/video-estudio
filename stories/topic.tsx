import { createContext, useContext } from "react";
import { DockedHeadline } from "../kit";
import { fitText } from "./layout";

export type TopicInfo = { index: number; name: string; line: string };

export const TopicContext = createContext<TopicInfo | null>(null);

/** Tema que se está mostrando (`index` desde 0). Solo vale dentro de una escena de tema armada por `composeStory`. */
export function useTopic(): TopicInfo {
  const t = useContext(TopicContext);
  if (!t) throw new Error("useTopic: solo se puede usar dentro de una escena armada con composeStory");
  return t;
}

/**
 * Titular del tema (píldora arriba a la izquierda) ya armado con el nombre y la línea del tema.
 * La escena decide cuándo mostrarlo (`start`) y cuándo apartarlo (`hide`, 0..1, p. ej. `hideFromScale(cam.scale)`).
 */
export function TopicHeadline({ start = 0, hide = 0, frame }: { start?: number; hide?: number; frame?: number }) {
  const t = useTopic();
  const title = fitText(t.name, 760, 32, { min: 22 }).text;
  return <DockedHeadline index={t.index + 1} title={title} start={start} hide={hide} frame={frame} />;
}
