import { staggerFrames } from "../themes";
import type { Theme } from "../themes";
import { INTERLUDE_COMPACT_FRAMES } from "./durations";
import { composeStory } from "./compose";
import type { ComposeOptions } from "./compose";
import { resolveTheme } from "./define";
import type { ThemeInput } from "./define";
import { INTERLUDE_FRAMES, INTERLUDE_T, REVEAL_STAGE_T, REVEAL_T, TICK_STEP, isStageReveal, nextTopic, revealBase } from "./Interlude";
import { closingLogoAt } from "./Closing";
import { openingFly, openingListAt } from "./Opening";
import { planScenes } from "./plan";
import { resolveStorySpec, scaler } from "./shared";
import { lateStart } from "./types";
import type { StorySpec, TopicScene } from "./types";

/**
 * Qué marca cada cuadro notable de la historia (para generar la lista de sonidos en vez de ubicarla a mano):
 * - `"opening-title"`: entra el cartel del título (cuadro 0 de la apertura).
 * - `"opening-list"`: entra la lista de titulares de la apertura.
 * - `"fly-in"`: arranca el atravesado de un titular (el del primer tema al final de la apertura, o el del que sigue en una vuelta).
 * - `"scene-start"`: primer cuadro de la escena de un tema.
 * - `"interlude-tick"`: el pulso de una tilde que se gana en una vuelta (cuadro de mayor brillo; en la compacta, cuando la tilde termina de dibujarse).
 * - `"reveal-enter"`: empieza a entrar la fila nueva (tema tardío) en la vuelta de revelación.
 * - `"reveal-sweep"`: arranca el barrido de luz sobre la fila nueva (solo con `design.reveal: "stage"`).
 * - `"reveal-tick"`: el pulso de la tilde de esa fila.
 * - `"closing-logo"`: empieza a entrar la marca de la firma (el logo, el `slot` o, sin ellos, el texto) en el cierre.
 */
export type StoryCueKind = "opening-title" | "opening-list" | "fly-in" | "scene-start" | "interlude-tick" | "reveal-enter" | "reveal-sweep" | "reveal-tick" | "closing-logo";

/** Un cuadro notable de la historia: `frame` es absoluto (desde el cuadro 0 del video) y `topic` el índice del tema (de `spec.topics`) o `null` si no es de un tema. */
export type StoryCue = { frame: number; kind: StoryCueKind; topic: number | null };

export type StoryCueOptions = ComposeOptions & {
  /** Design system con el que se renderiza (cambia, p. ej., cómo termina la apertura y el paso entre tildes); `neutral` por defecto. */
  theme?: ThemeInput;
  /** Tamaño del cuadro (1920 x 1080 por defecto): el diseño del tema depende del formato. */
  width?: number;
  height?: number;
};

/**
 * Cuadros notables de la historia, ordenados por cuadro, como datos `{ frame, kind, topic }`: salen de las mismas constantes de tiempo que usan las
 * piezas (apertura, vueltas, cierre), así que coinciden con lo que se dibuja (lo comprueba `stories/stories.test.tsx`). `scenes` y `opts` son los de `composeStory`
 * (más `theme`, `width` y `height` si el video no usa el tema neutro en 1920 x 1080).
 */
export function storyCues(spec: StorySpec, scenes: (TopicScene | null | undefined)[], opts: StoryCueOptions = {}): StoryCue[] {
  const { timeline } = composeStory(spec, scenes, opts);
  const theme: Theme = resolveTheme(opts.theme);
  const rs = resolveStorySpec(theme, spec, opts.width ?? 1920, opts.height ?? 1080);
  const sc = scenes.length === 0 ? spec.topics.map(() => null) : scenes.map((s) => s ?? null);
  const withInterludes = opts.interludes ?? true;
  const compact = withInterludes === "compact";
  const plan = new Map(planScenes(spec, sc.map((s) => s !== null), withInterludes).map((p) => [p.topic, p]));
  const skip = sc.flatMap((s, i) => (s ? [] : [i]));
  const first = sc.findIndex((s) => s !== null);
  const out: StoryCue[] = [];
  const add = (frame: number, kind: StoryCueKind, topic: number | null) => out.push({ frame: Math.round(frame), kind, topic });
  for (const e of timeline) {
    const dur = e.durationInFrames;
    if (e.kind === "opening") {
      add(e.from, "opening-title", null);
      add(e.from + openingListAt(dur), "opening-list", null);
      if (first >= 0) add(e.from + openingFly(dur, rs.design?.handoff === "dock", rs.design?.handoff === "through")[0], "fly-in", first);
    } else if (e.kind === "topic") {
      add(e.from, "scene-start", e.topic!);
    } else if (e.kind === "closing") {
      add(e.from + closingLogoAt(dur), "closing-logo", null);
    } else {
      const i = e.topic!; // el último tema visto
      const ticks = plan.get(i)?.interlude?.ticks ?? [i];
      if (compact) {
        add(e.from + scaler(dur, INTERLUDE_COMPACT_FRAMES)(18), "interlude-tick", i);
        continue;
      }
      const reveal = e.reveal === true;
      const stage = reveal && isStageReveal(rs);
      const u = scaler(dur, reveal ? revealBase(rs) : INTERLUDE_FRAMES);
      const R = stage ? REVEAL_STAGE_T : REVEAL_T;
      const check = reveal ? R.check : INTERLUDE_T.check;
      ticks.forEach((t, order) => {
        // el pulso llega 2 cuadros después de que la tilde termina de dibujarse (el brillo de `Interlude`)
        const off = order > 0 ? u(staggerFrames(theme, order, { base: TICK_STEP, context: "rows" })) : 0;
        add(e.from + u(check[1] + 2) + off, "interlude-tick", t);
      });
      if (reveal) {
        add(e.from + u(R.enter[0] + (stage ? 4 : 0)), "reveal-enter", i); // con la escenificada, cuando la fila ya se ve (el resorte arranca invisible)
        if (stage) add(e.from + u(REVEAL_STAGE_T.sweep[0]), "reveal-sweep", i);
        add(e.from + u(R.lateCheck[1] + 2), "reveal-tick", i);
      } else {
        const next = nextTopic(lateStart(spec), i + 1, skip);
        if (next >= 0) add(e.from + u(INTERLUDE_T.fly[0]), "fly-in", next);
      }
    }
  }
  return out.sort((a, b) => a.frame - b.frame);
}
