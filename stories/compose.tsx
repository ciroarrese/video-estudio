import React from "react";
import { Audio, Fill, Sequence } from "../engine";
import { StoryStage, useStorySpec } from "./shared";
import { Closing, closingFrames } from "./Closing";
import { Interlude, interludeFrames, nextTopic } from "./Interlude";
import { InterludeCompact, interludeCompactFrames } from "./InterludeCompact";
import { Opening, openingFrames } from "./Opening";
import { TopicContext, headlineDefaults } from "./topic";
import { isReservedSceneId, validateSpec } from "./types";
import type { StorySpec, TopicScene } from "./types";

export type TimelineEntry = {
  id: string;
  kind: "opening" | "topic" | "interlude" | "closing";
  from: number;
  durationInFrames: number;
  /** Índice del tema (de `spec.topics`) al que pertenece la entrada: en un tema, el suyo; en una vuelta, el último tema visto. */
  topic?: number;
};

export type ComposeOptions = {
  /**
   * Vuelta al listado entre un tema y otro: `true` (por defecto) la lista completa con el siguiente tema atravesado (120 cuadros);
   * `"compact"` una tira de progreso con el tema visto y el que sigue (40 cuadros, mínimo 24); `false` sin vueltas.
   */
  interludes?: boolean | "compact";
  /** Pista de audio que cubre todo el video. */
  audio?: { src: string; startFrom?: number; volume?: number };
};

/**
 * Apertura → (escena de tema → vuelta al listado)×n → cierre. Cada escena de tema va dentro de un `Stage` y puede usar `useTopic()`.
 *
 * `scenes` va parejo a `spec.topics` (mismo orden). Un tema sin escena se indica con `null` (o `undefined`): sale en la lista de la apertura y
 * en el cierre (con `topic.thumbnail` o la tarjeta por defecto), se saltea en el medio y no tiene vuelta al listado. Una lista vacía vale
 * por "ningún tema tiene escena" (solo apertura y cierre).
 */
export function composeStory(
  spec: StorySpec,
  scenesIn: (TopicScene | null | undefined)[],
  opts: ComposeOptions = {},
): { component: React.FC; durationInFrames: number; timeline: TimelineEntry[] } {
  validateSpec(spec);
  const scenes: (TopicScene | null)[] = scenesIn.length === 0 ? spec.topics.map(() => null) : scenesIn.map((s) => s ?? null);
  if (scenes.length !== spec.topics.length) {
    throw new Error(`composeStory: hay ${spec.topics.length} temas y ${scenes.length} escenas; deben coincidir en orden (usá null para un tema sin escena)`);
  }
  const seen = new Set<string>();
  for (const s of scenes) {
    if (!s) continue;
    if (typeof s.id !== "string" || s.id === "") throw new Error("composeStory: cada escena necesita un id (texto no vacío)");
    if (isReservedSceneId(s.id)) throw new Error(`composeStory: el id "${s.id}" está reservado (opening, closing, interlude-N); elegí otro para la escena`);
    if (seen.has(s.id)) throw new Error(`composeStory: el id de escena "${s.id}" está repetido; cada escena necesita uno único`);
    seen.add(s.id);
    if (!Number.isInteger(s.durationInFrames) || s.durationInFrames <= 0) {
      throw new Error(`composeStory: la escena "${s.id}" necesita durationInFrames entero > 0 (recibió ${s.durationInFrames})`);
    }
  }
  const withInterludes = opts.interludes ?? true;
  const compact = withInterludes === "compact";
  const timeline: TimelineEntry[] = [];
  // Índice de tema de cada entrada (y, en las vueltas al listado, cuántos temas van hechos): se arma acá, no se deduce del id.
  const topicOf: number[] = [];
  let at = 0;
  const push = (id: string, kind: TimelineEntry["kind"], d: number, topic = -1) => {
    timeline.push({ id, kind, from: at, durationInFrames: d, ...(kind === "topic" ? { topic } : kind === "interlude" ? { topic: topic - 1 } : {}) });
    topicOf.push(topic);
    at += d;
  };
  // índices de los temas sin escena y primer tema con escena (el que cierra la apertura)
  const skip = scenes.flatMap((s, i) => (s ? [] : [i]));
  const first = scenes.findIndex((s) => s !== null);
  push("opening", "opening", openingFrames(spec));
  let lap = 0; // número de vuelta (1, 2, ...) entre los temas con escena
  scenes.forEach((s, i) => {
    if (!s) return;
    push(s.id, "topic", s.durationInFrames, i);
    if (withInterludes) push(`interlude-${++lap}`, "interlude", compact ? interludeCompactFrames(spec) : interludeFrames(spec), i + 1);
  });
  push("closing", "closing", closingFrames(spec));

  const Story: React.FC = () => {
    // diseño del video sobre el del design system: acople, nubes y titular de las escenas salen de acá (los bloques lo mezclan por su cuenta)
    const rs = useStorySpec(spec);
    return (
      <Fill>
        {timeline.map((e, k) => {
          let body: React.ReactNode;
          if (e.kind === "opening") body = <Opening spec={spec} first={Math.max(0, first)} dock={first >= 0 && rs.design?.handoff === "dock"} through={first >= 0 && rs.design?.handoff === "through"} />;
          else if (e.kind === "closing") body = <Closing spec={spec} scenes={scenes} />;
          else if (e.kind === "interlude") {
            const done = topicOf[k]!;
            const next = nextTopic(spec.topics.length, done, skip);
            body = compact ? <InterludeCompact spec={spec} done={done} skip={skip} next={next} /> : <Interlude spec={spec} done={done} skip={skip} next={next} />;
          }
          else {
            const topic = topicOf[k]!;
            const t = spec.topics[topic]!;
            const Scene = scenes[topic]!.component;
            body = (
              <TopicContext.Provider value={{ index: topic, name: t.name, line: t.line, docked: topic === first && rs.design?.handoff === "dock", headline: headlineDefaults(rs) }}>
                <StoryStage cloud={rs.design?.clouds}>
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
