import React from "react";
import { Audio, Fill, Sequence } from "../engine";
import { Stage } from "../kit";
import { Closing, closingFrames } from "./Closing";
import { Interlude, interludeFrames } from "./Interlude";
import { Opening, openingFrames } from "./Opening";
import { TopicContext } from "./topic";
import { validateSpec } from "./types";
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
  for (const s of scenes) {
    if (!Number.isFinite(s.durationInFrames) || s.durationInFrames <= 0) throw new Error(`composeStory: la escena "${s.id}" necesita durationInFrames > 0`);
  }
  const withInterludes = opts.interludes ?? true;
  const timeline: TimelineEntry[] = [];
  let at = 0;
  const push = (id: string, kind: TimelineEntry["kind"], d: number) => {
    timeline.push({ id, kind, from: at, durationInFrames: d });
    at += d;
  };
  push("opening", "opening", openingFrames(spec));
  scenes.forEach((s, i) => {
    push(s.id, "topic", s.durationInFrames);
    if (withInterludes) push(`interlude-${i + 1}`, "interlude", interludeFrames(spec));
  });
  push("closing", "closing", closingFrames(spec));

  const Story: React.FC = () => {
    let topic = -1;
    return (
      <Fill>
        {timeline.map((e) => {
          let body: React.ReactNode;
          if (e.kind === "opening") body = <Opening spec={spec} />;
          else if (e.kind === "closing") body = <Closing spec={spec} scenes={scenes} />;
          else if (e.kind === "interlude") body = <Interlude spec={spec} done={Number(e.id.slice("interlude-".length))} />;
          else {
            topic += 1;
            const t = spec.topics[topic]!;
            const Scene = scenes[topic]!.component;
            body = (
              <TopicContext.Provider value={{ index: topic, name: t.name, line: t.line }}>
                <Stage>
                  <Scene />
                </Stage>
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
