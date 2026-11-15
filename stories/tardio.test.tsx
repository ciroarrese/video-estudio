import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral } from "../themes";
import { Closing, Interlude, Opening, budgetFromScenes, composeStory, storyBudget, storyCues, useTopic, validateSpec } from "./index";
import type { StorySpec, TopicScene } from "./index";
import { interludeRevealFrames } from "./Interlude";

// Historia con un último tema sorpresa (`reveal: "late"`), escenas sin vuelta (`interludeBefore: false`) y pulsos de las tildes.

const spec = (n: number, over: Partial<StorySpec> = {}): StorySpec => ({
  title: { text: "Título de prueba" },
  topics: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `Tema ${["uno", "dos", "tres", "cuatro", "cinco", "seis"][i]}`, line: `línea ${i + 1}` })),
  labels: ["Alfa", "Beta", "Gamma"],
  signoff: { text: "Fin", slot: <span>MARCA</span> } as StorySpec["signoff"],
  ...over,
});
const late = (s: StorySpec): StorySpec => ({ ...s, topics: s.topics.map((t, i) => (i === s.topics.length - 1 ? { ...t, reveal: "late" as const } : t)) });
const seen: Record<string, { handoff?: string; arrival?: string }> = {};
const scenes = (n: number, dur = 100): TopicScene[] => Array.from({ length: n }, (_, i) => ({
  id: `s${i}`, durationInFrames: dur,
  component: () => { const t = useTopic(); seen[`s${i}`] = { handoff: t.handoff, arrival: t.arrival }; return <div>escena-{i}</div>; },
}));
const cfg = { fps: 30, width: 1920, height: 1080, durationInFrames: 5000 };
const html = (el: React.ReactNode, f: number, c = cfg) => renderToString(<FrameProvider frame={f} config={c}><ThemeProvider theme={neutral}>{el}</ThemeProvider></FrameProvider>);

describe("tema tardío: validación", () => {
  it("solo uno, el último, con escena y con al menos 2 temas en la lista", () => {
    expect(() => validateSpec(late(spec(5)))).not.toThrow();
    const s = spec(4);
    expect(() => validateSpec({ ...s, topics: s.topics.map((t, i) => (i === 1 ? { ...t, reveal: "late" as const } : t)) })).toThrow(/último/);
    expect(() => validateSpec({ ...s, topics: s.topics.map((t) => ({ ...t, reveal: "late" as const })) })).toThrow(/solo un tema/);
    expect(() => validateSpec(late(spec(2)))).toThrow(/al menos 2/);
    expect(() => validateSpec({ ...late(s), topics: late(s).topics.map((t) => (t.reveal ? { ...t, interludeBefore: true } : t)) })).toThrow(/interludeBefore/);
    expect(() => validateSpec(late({ ...s, timing: { interludeReveal: 89 } }))).toThrow(/>= 90/);
    expect(() => composeStory(late(spec(4)), [...scenes(3), null])).toThrow(/necesita escena/);
    expect(() => composeStory(spec(3, { topics: spec(3).topics.map((t, i) => (i === 0 ? { ...t, interludeBefore: false } : t)) }), scenes(3))).toThrow(/primer tema/);
  });
});

describe("tema tardío: línea de tiempo, handoff y duración de la escena", () => {
  const s = late(spec(4));
  const sc = scenes(4);
  sc[2] = { ...sc[2]!, durationInFrames: 60 }; // la historia corta la escena antes de su salida
  const { timeline, durationInFrames, component: Story } = composeStory(s, sc);
  it("la escena tardía sigue a la anterior sin vuelta y después viene la revelación (150)", () => {
    expect(timeline.map((e) => e.id)).toEqual(["opening", "s0", "interlude-1", "s1", "interlude-2", "s2", "s3", "interlude-reveal", "closing"]);
    const rev = timeline.find((e) => e.id === "interlude-reveal")!;
    expect(rev).toMatchObject({ durationInFrames: 150, reveal: true, topic: 3 });
    expect(timeline.find((e) => e.id === "s2")!.durationInFrames).toBe(60); // duración de la entrada, no la de la escena
    let at = 0;
    for (const e of timeline) { expect(e.from).toBe(at); at += e.durationInFrames; }
    expect(at).toBe(durationInFrames);
    expect(interludeRevealFrames({ ...s, timing: { interludeReveal: 90 } })).toBe(90);
  });
  it("cada escena sabe cómo sigue y cómo llegó", () => {
    for (const e of timeline) html(<Story />, e.from + 3);
    expect(seen.s0).toEqual({ handoff: "list", arrival: "opening" });
    expect(seen.s1).toEqual({ handoff: "list", arrival: "list" });
    expect(seen.s2).toEqual({ handoff: "next-scene", arrival: "list" });
    expect(seen.s3).toEqual({ handoff: "list", arrival: "previous-scene" });
  });
  it("la escena cortada no se dibuja pasada su duración: sigue la siguiente en el cuadro justo", () => {
    const e = timeline.find((x) => x.id === "s2")!;
    expect(html(<Story />, e.from + 59)).toContain("escena-<!-- -->2");
    expect(html(<Story />, e.from + 60)).not.toContain("escena-<!-- -->2");
    expect(html(<Story />, e.from + 60)).toContain("escena-<!-- -->3");
  });
  it("interludeBefore: false en un tema común; sin vueltas el último sale al cierre", () => {
    const t = spec(3, { topics: spec(3).topics.map((x, i) => (i === 2 ? { ...x, interludeBefore: false } : x)) });
    expect(composeStory(t, scenes(3)).timeline.map((e) => e.id)).toEqual(["opening", "s0", "interlude-1", "s1", "s2", "interlude-2", "closing"]);
    seen.s1 = {}; const c = composeStory(late(spec(4)), scenes(4), { interludes: false });
    for (const e of c.timeline) html(<c.component />, e.from + 3);
    expect(seen.s2).toEqual({ handoff: "next-scene", arrival: "previous-scene" });
    expect(seen.s3).toEqual({ handoff: "closing", arrival: "previous-scene" });
    expect(c.timeline.some((e) => e.kind === "interlude")).toBe(false);
  });
  it("el presupuesto y --list-scenes cuentan la vuelta de revelación", () => {
    const b = storyBudget(s, sc);
    expect(b.reveal).toMatchObject({ count: 1, frames: 150, min: 90 });
    expect(b.interlude.count).toBe(2);
    expect(b.total).toBe(durationInFrames);
    const bs = budgetFromScenes(timeline, 30)!;
    expect(bs.total).toBe(durationInFrames);
    expect(bs.reveal.count).toBe(1);
    expect(bs.interlude.count).toBe(2);
    expect(bs.minTotal).toBe(b.minTotal);
  });
});

describe("tema tardío: qué se ve", () => {
  const s = late(spec(4));
  const wall = { ...s, labels: [] };
  it("la apertura y las vueltas anteriores no lo muestran; la revelación sí (y cierra con todos)", () => {
    for (const f of [0, 150, 299]) expect(html(<Opening spec={wall} />, f)).not.toContain("Tema cuatro");
    for (const f of [0, 60, 119]) expect(html(<Interlude spec={s} done={1} />, f)).not.toContain("Tema cuatro");
    expect(html(<Interlude spec={s} done={3} next={-1} />, 60)).not.toContain("Tema cuatro");
    expect(html(<Interlude spec={s} done={4} ticks={[2]} />, 0, { ...cfg })).not.toContain("Tema cuatro"); // todavía no entró
    expect(html(<Interlude spec={s} done={4} ticks={[2]} />, 100)).toContain("Tema cuatro");
    expect(html(<Closing spec={s} />, 300)).toContain("Tema cuatro");
  });
  it("el cierre con 5 y 6 temas (el último tardío) entra en los tres formatos", () => {
    for (const [w, h] of [[1920, 1080], [1080, 1920], [1080, 1080]]) for (const n of [5, 6]) {
      const m = late(spec(n));
      for (const f of [0, 250, 479]) expect(html(<Closing spec={m} />, f, { ...cfg, width: w, height: h }), `${w}x${h} n=${n}`).toBeTruthy();
    }
  });
});

describe("storyCues", () => {
  const s = late(spec(4));
  const sc = scenes(4);
  const cues = storyCues(s, sc);
  const tl = composeStory(s, sc).timeline;
  const by = (k: string) => cues.filter((c) => c.kind === k);
  it("forma, orden y contenido", () => {
    expect(cues.map((c) => c.frame)).toEqual([...cues.map((c) => c.frame)].sort((a, b) => a - b));
    expect(by("opening-title")).toEqual([{ frame: 0, kind: "opening-title", topic: null }]);
    expect(by("scene-start").map((c) => c.topic)).toEqual([0, 1, 2, 3]);
    expect(by("fly-in").map((c) => c.topic)).toEqual([0, 1, 2]); // apertura -> 1.º, vueltas -> 2.º y 3.º (el tardío no se atraviesa)
    expect(by("interlude-tick").map((c) => c.topic)).toEqual([0, 1, 2]);
    expect(by("reveal-enter")).toHaveLength(1);
    expect(by("reveal-tick")).toHaveLength(1);
    expect(by("reveal-tick")[0]!.topic).toBe(3);
  });
  /** Brillo (blur px de la sombra del pulso) de un cuadro de una vuelta. */
  const glow = (el: React.ReactElement, f: number) => Math.max(0, ...[...html(el, f).matchAll(/box-shadow:0 0 ([\d.]+)px/g)].map((m) => Number(m[1])));
  it("el cuadro del pulso de cada tilde es el de mayor brillo de la pieza", () => {
    const e1 = tl.find((e) => e.id === "interlude-1")!;
    const tick = by("interlude-tick")[0]!.frame - e1.from;
    const g = Array.from({ length: e1.durationInFrames }, (_, f) => glow(<Interlude spec={s} done={1} />, f));
    expect(g.indexOf(Math.max(...g))).toBe(tick);
    const er = tl.find((e) => e.id === "interlude-reveal")!;
    const rev = by("reveal-tick")[0]!.frame - er.from;
    const gr = Array.from({ length: er.durationInFrames }, (_, f) => glow(<Interlude spec={s} done={4} ticks={[2]} />, f));
    expect(gr.indexOf(Math.max(...gr.slice(80)), 80)).toBe(rev);
    expect(gr.indexOf(Math.max(...gr.slice(0, 60)))).toBe(by("interlude-tick")[2]!.frame - er.from);
  });
  it("la fila nueva entra en el cuadro de reveal-enter y la marca del cierre en closing-logo", () => {
    const er = tl.find((e) => e.id === "interlude-reveal")!;
    const enter = by("reveal-enter")[0]!.frame - er.from;
    const el = <Interlude spec={s} done={4} ticks={[2]} />;
    expect(html(el, enter - 1)).not.toContain("Tema cuatro");
    expect(html(el, enter + 1)).toContain("Tema cuatro");
    const ec = tl.find((e) => e.id === "closing")!;
    const logo = by("closing-logo")[0]!.frame - ec.from;
    const vis = (f: number) => /visibility:hidden/.test(html(<Closing spec={s} />, f).split("MARCA")[0]!.slice(-200));
    expect(vis(logo)).toBe(true);
    expect(vis(logo + 2)).toBe(false);
  });
});
