import React from "react";
import { Audio, Fill, Sequence } from "../engine";
import { Closing, closingFrames } from "./Closing";
import { Interlude, interludeFrames } from "./Interlude";
import { Opening, openingFrames } from "./Opening";
import { StoryStage } from "./shared";
import { TopicContext } from "./topic";
import { isReservedSceneId, validateSpec } from "./types";
import type { StorySpec, TopicScene } from "./types";

export type TimelineEntry = { id: string; kind: "opening" | "topic" | "interlude" | "closing"; from: number; durationInFrames: number };

export type ComposeOptions = {
  /** Vuelta al listado entre un tema y otro (por defecto true). */
  interludes?: boolean;
  /** Pista de audio que cubre todo el video. */
  audio?: { src: string; startFrom?: number; volume?: number };
};

/** Apertura → (escena de tema → vuelta al listado)×n → cierre. Cada escena de tema va dentro de un `Stage` y puede usar `useTopic()`. */
export function composeStory(
  spec: StorySpec,
  scenes: TopicScene[],
  opts: ComposeOptions = {},
): { component: React.FC; durationInFrames: number; timeline: TimelineEntry[] } {
  validateSpec(spec);
  if (scenes.length !== spec.topics.length) {
    throw new Error(`composeStory: hay ${spec.topics.length} temas y ${scenes.length} escenas; deben coincidir en orden`);
  }
  const seen = new Set<string>();
  for (const s of scenes) {
    if (typeof s.id !== "string" || s.id === "") throw new Error("composeStory: cada escena necesita un id (texto no vacío)");
    if (isReservedSceneId(s.id)) throw new Error(`composeStory: el id "${s.id}" está reservado (opening, closing, interlude-N); elegí otro para la escena`);
    if (seen.has(s.id)) throw new Error(`composeStory: el id de escena "${s.id}" está repetido; cada escena necesita uno único`);
    seen.add(s.id);
    if (!Number.isInteger(s.durationInFrames) || s.durationInFrames <= 0) {
      throw new Error(`composeStory: la escena "${s.id}" necesita durationInFrames entero > 0 (recibió ${s.durationInFrames})`);
    }
  }
  const withInterludes = opts.interludes ?? true;
  const timeline: TimelineEntry[] = [];
  // Índice de tema de cada entrada (y, en las vueltas al listado, cuántos temas van hechos): se arma acá, no se deduce del id.
  const topicOf: number[] = [];
  let at = 0;
  const push = (id: string, kind: TimelineEntry["kind"], d: number, topic = -1) => {
    timeline.push({ id, kind, from: at, durationInFrames: d });
    topicOf.push(topic);
    at += d;
  };
  push("opening", "opening", openingFrames(spec));
  scenes.forEach((s, i) => {
    push(s.id, "topic", s.durationInFrames, i);
    if (withInterludes) push(`interlude-${i + 1}`, "interlude", interludeFrames(spec), i + 1);
  });
  push("closing", "closing", closingFrames(spec));

  const Story: React.FC = () => {
    return (
      <Fill>
        {timeline.map((e, k) => {
          let body: React.ReactNode;
          if (e.kind === "opening") body = <Opening spec={spec} />;
          else if (e.kind === "closing") body = <Closing spec={spec} scenes={scenes} />;
          else if (e.kind === "interlude") body = <Interlude spec={spec} done={topicOf[k]!} />;
          else {
            const topic = topicOf[k]!;
            const t = spec.topics[topic]!;
            const Scene = scenes[topic]!.component;
            body = (
              <TopicContext.Provider value={{ index: topic, name: t.name, line: t.line }}>
                <StoryStage>
                  <Scene />
                </StoryStage>
              </TopicContext.Provider>
            );
          }
          return (
            <Sequence key={e.id} from={e.from} durationInFrames={e.durationInFrames}>
              {body}
            </Sequence>
          );
        })}
        {opts.audio && <Audio src={opts.audio.src} startFrom={opts.audio.startFrom} volume={opts.audio.volume} />}
      </Fill>
    );
  };
  return { component: Story, durationInFrames: at, timeline };
}
