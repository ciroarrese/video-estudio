import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider, createStage, defineVideo } from "../engine";
import { ThemeProvider, dark, neutral } from "../themes";
import type { Theme } from "../themes";
import { demoScenes, spec as demoSpec, storyDemo } from "../examples/story-demo/StoryDemo";
import {
  CLOSING_FRAMES, Closing, INTERLUDE_FRAMES, Interlude, OPENING_FRAMES, Opening, composeStory, fitText, useTopic, validateSpec,
} from "./index";
import type { StorySpec, TopicScene } from "./index";
import { closingWall, labelAt, listLayout, panelLayout, reservedSlots, textWidth } from "./layout";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 1000 };
const html = (node: React.ReactNode, theme: Theme, frame: number) =>
  renderToString(
    <FrameProvider frame={frame} config={config}>
      <ThemeProvider theme={theme}>{node}</ThemeProvider>
    </FrameProvider>,
  );

const specN = (n: number, over: Partial<StorySpec> = {}): StorySpec => ({
  title: { text: "Título de prueba", highlight: "prueba" },
  topics: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `Tema número ${i + 1}`, line: `línea descriptiva del tema ${i + 1}` })),
  labels: ["Uno", "Dos", "Tres", "Cuatro", "Cinco"],
  signoff: { text: "Hasta la próxima", tagline: "Nota final" },
  ...over,
});
const scenesN = (n: number, dur = 100): TopicScene[] => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, component: () => <div>escena {i}</div>, durationInFrames: dur + i * 10 }));

// Tema donde cada valor es único (mismo enfoque que kit/render.test.tsx)
const C = (n: number) => `rgb(${n}, ${n + 1}, ${n + 2})`;
const sentinel: Theme = {
  name: "sentinel",
  color: { bg: C(1), surface: C(11), surfaceAlt: C(21), text: C(31), textMuted: C(41), border: C(51), accent: C(61), accent2: C(71), onAccent: C(81), success: C(91), warning: C(101), danger: C(111), chart: [C(121), C(131)] },
  gradient: { brand: `linear-gradient(90deg, ${C(141)}, ${C(151)})` },
  font: { family: '"SentinelFont", serif', weights: { regular: 411, medium: 522, semibold: 633, stat: 744 } },
  radius: { sm: 7001, md: 7002, panel: 7003, lg: 7004, pill: 7005 },
  shadow: { sm: `0 0 0 3001px ${C(161)}`, md: `0 0 0 3002px ${C(171)}`, lg: `0 0 0 3003px ${C(181)}` },
  type: { hero: 120, h1: 96, h2: 72, body: 44, caption: 32, eyebrow: 26, stat: 180 },
  safe: { x: 140, y: 110 },
  motion: { easing: { standard: [0.1, 0.2, 0.3, 0.4], out: [0.2, 0.3, 0.4, 0.5], inOut: [0.3, 0.4, 0.5, 0.6] }, duration: { fast: 3, base: 6, slow: 9 } },
  cloud: { colors: [C(191), C(201)], opacity: 0.77 },
};
const NAMED = /\b(white|black|red|green|blue|gray|grey|orange|purple|pink|yellow|silver|navy|teal|cyan|magenta|brown|gold)\b/i;

function strip(markup: string): string {
  let m = markup;
  const cols = [...Object.values(sentinel.color).flat(), ...sentinel.cloud.colors] as string[];
  for (const c of cols) {
    const [r, g, b] = c.match(/\d+/g)!;
    m = m.replace(new RegExp(`rgba\\(${r}, ${g}, ${b}, [0-9.e-]+\\)`, "g"), "");
  }
  for (const v of [sentinel.gradient.brand, ...Object.values(sentinel.shadow)]) m = m.split(v).join("");
  for (const c of cols) m = m.split(c).join("");
  return m;
}

function assertThemed(markup: string) {
  const rest = strip(markup);
  expect(rest).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(rest).not.toMatch(/rgba?\(|hsla?\(/);
  const styles = (rest.match(/(?:style|fill|stroke|stop-color)="[^"]*"/g) ?? []).join(" ");
  expect(styles.replace(/transparent|none|white-space/g, "").match(NAMED)?.[0]).toBeUndefined();
  const radii = new Set(Object.values(sentinel.radius).flatMap((r) => [`${r}px`, `${r * 2}px`]));
  for (const m of markup.matchAll(/border-radius:([^;"]+)/g)) expect(radii.has(m[1]!.trim()), `border-radius ${m[1]}`).toBe(true);
}

describe("composeStory timeline", () => {
  for (const n of [2, 3, 6]) {
    for (const interludes of [true, false]) {
      it(`${n} topics, interludes=${interludes}: contiguous, no gaps, total = sum`, () => {
        const scenes = scenesN(n);
        const { timeline, durationInFrames } = composeStory(specN(n), scenes, { interludes });
        let at = 0;
        for (const e of timeline) {
          expect(e.from).toBe(at);
          expect(e.durationInFrames).toBeGreaterThan(0);
          at += e.durationInFrames;
        }
        expect(durationInFrames).toBe(at);
        const expected = OPENING_FRAMES + CLOSING_FRAMES + scenes.reduce((a, s) => a + s.durationInFrames, 0) + (interludes ? n * INTERLUDE_FRAMES : 0);
        expect(durationInFrames).toBe(expected);
        expect(timeline.map((e) => e.kind)).toEqual(["opening", ...scenes.flatMap(() => (interludes ? ["topic", "interlude"] : ["topic"])), "closing"]);
        expect(timeline.filter((e) => e.kind === "topic").map((e) => e.id)).toEqual(scenes.map((s) => s.id));
      });
    }
  }
  it("timing overrides change durations", () => {
    const { timeline } = composeStory(specN(2, { timing: { opening: 200, interlude: 90, closing: 300 } }), scenesN(2));
    expect(timeline[0]!.durationInFrames).toBe(200);
    expect(timeline.find((e) => e.kind === "interlude")!.durationInFrames).toBe(90);
    expect(timeline.at(-1)!.durationInFrames).toBe(300);
  });
  it("rejects 1 and 7 topics and mismatched scenes", () => {
    expect(() => validateSpec(specN(1))).toThrow(/entre 2 y 6/);
    expect(() => validateSpec(specN(7))).toThrow(/entre 2 y 6/);
    expect(() => composeStory(specN(3), scenesN(2))).toThrow(/deben coincidir/);
  });
  it("renders each segment with useTopic and the right interlude counter", () => {
    const seen: string[] = [];
    const scenes: TopicScene[] = [0, 1].map((i) => ({ id: `s${i}`, durationInFrames: 50, component: () => { const t = useTopic(); seen.push(`${t.index}:${t.name}`); return <span>x</span>; } }));
    const s = specN(2);
    const { component: Story, timeline } = composeStory(s, scenes);
    for (const e of timeline) html(<Story />, neutral, e.from + 5);
    expect(seen).toEqual(["0:Tema número 1", "1:Tema número 2"]);
  });
});

describe("components render", () => {
  const long = specN(6, {
    title: { text: "Un título larguísimo que sigue y sigue sin parar hasta que ocupa varias líneas completas del cuadro", highlight: "varias líneas" },
    topics: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, name: `Nombre extremadamente largo del tema número ${i + 1} que no entra`, line: "una línea descriptiva muy pero muy larga ".repeat(6) })),
    labels: ["Una etiqueta con un texto demasiado largo para caber en una pieza del muro"],
    signoff: { text: "Una despedida enorme ".repeat(8), tagline: "Una nota ".repeat(30) },
  });
  const frames = (d: number) => [0, 1, Math.floor(d * 0.2), Math.floor(d * 0.5), Math.floor(d * 0.8), d - 1];
  for (const theme of [neutral, dark]) {
    for (let n = 2; n <= 6; n++) {
      it(`${theme.name}, ${n} topics: Opening/Interlude/Closing render`, () => {
        const s = specN(n);
        for (const f of frames(OPENING_FRAMES)) expect(html(<Opening spec={s} />, theme, f).length).toBeGreaterThan(50);
        for (let d = 1; d <= n; d++) for (const f of frames(INTERLUDE_FRAMES)) expect(html(<Interlude spec={s} done={d} />, theme, f).length).toBeGreaterThan(50);
        for (const f of frames(CLOSING_FRAMES)) expect(html(<Closing spec={s} scenes={scenesN(n)} />, theme, f).length).toBeGreaterThan(50);
      });
    }
    it(`${theme.name}: long names and empty labels do not throw`, () => {
      for (const s of [long, { ...long, labels: [] }]) {
        for (const f of frames(OPENING_FRAMES)) expect(() => html(<Opening spec={s} />, theme, f)).not.toThrow();
        for (const f of frames(INTERLUDE_FRAMES)) expect(() => html(<Interlude spec={s} done={3} />, theme, f)).not.toThrow();
        for (const f of frames(CLOSING_FRAMES)) expect(() => html(<Closing spec={s} scenes={scenesN(6)} />, theme, f)).not.toThrow();
      }
    });
  }
});

describe("layout", () => {
  it("fitText shrinks, then truncates, and never exceeds the width estimate", () => {
    expect(fitText("hola", 500, 40)).toEqual({ text: "hola", size: 40 });
    const a = fitText("x".repeat(60), 500, 40);
    expect(a.size).toBeLessThan(40);
    expect(a.text.length * 0.56 * a.size).toBeLessThanOrEqual(500 + 1);
    const b = fitText("x".repeat(400), 500, 40);
    expect(b.text.endsWith("…")).toBe(true);
    expect(b.text.length * 0.56 * b.size).toBeLessThanOrEqual(500 + 1);
  });
  it("list fits the safe area for 2..6 topics, with long text too", () => {
    for (let n = 2; n <= 6; n++) {
      for (const s of [specN(n), { ...specN(n), topics: specN(n).topics.map((t) => ({ ...t, name: t.name.repeat(5), line: t.line.repeat(5) })) }]) {
        const L = listLayout(s, neutral, 1920, 1080);
        expect(L.top).toBeGreaterThanOrEqual(neutral.safe.y);
        expect(L.top + n * L.rowH).toBeLessThanOrEqual(1080 - neutral.safe.y + 1);
        expect(L.blockTop + L.blockH).toBeLessThanOrEqual(L.rowH);
        const avail = L.rowW - L.numW;
        for (let i = 0; i < n; i++) {
          expect(L.names[i]!.length * 0.56 * L.nameSize).toBeLessThanOrEqual(avail + 1);
          expect(L.lines[i]!.length * 0.52 * L.lineSize).toBeLessThanOrEqual(avail + 1);
        }
      }
    }
  });
  it("reserved slots and panels: n entries, inside the frame, wall chips avoid slots", () => {
    for (let n = 2; n <= 6; n++) {
      expect(reservedSlots(n)).toHaveLength(n);
      const p = panelLayout(n);
      expect(p).toHaveLength(n);
      for (const q of p) {
        expect(q.x - 280 * q.k).toBeGreaterThanOrEqual(100);
        expect(q.x + 280 * q.k).toBeLessThanOrEqual(1820);
      }
      const { inner, slots } = closingWall(specN(n));
      for (const c of inner) for (const s of slots) expect(Math.abs(c.x - s.x) < 480 && Math.abs(c.y - s.y) < 120).toBe(false);
    }
  });
});

describe("purity", () => {
  it("frame A then B equals a fresh B, with the full story (both themes)", () => {
    const { component, durationInFrames } = composeStory(demoSpec, demoScenes);
    const def = defineVideo({ id: "story-purity", component: (p: { theme?: "neutral" | "dark" }) => <ThemeProvider theme={p.theme === "dark" ? dark : neutral}>{React.createElement(component)}</ThemeProvider>, fps: 30, width: 1920, height: 1080, durationInFrames });
    const pairs: [number, number][] = [[250, 20], [330, 305], [durationInFrames - 100, 70], [200, durationInFrames - 1]];
    for (const theme of ["neutral", "dark"] as const) {
      for (const [a, b] of pairs) {
        const h1 = document.createElement("div");
        const s1 = createStage(h1, def, { theme });
        s1.render(a);
        s1.render(b);
        const h2 = document.createElement("div");
        const s2 = createStage(h2, def, { theme });
        s2.render(b);
        expect(s1.html()).toBe(s2.html());
        s1.destroy();
        s2.destroy();
      }
    }
  });
  it("story-demo is registered with the expected size", () => {
    expect(storyDemo).toMatchObject({ id: "story-demo", width: 1920, height: 1080, fps: 30 });
    expect(storyDemo.durationInFrames).toBe(300 + 3 * 150 + 3 * 120 + CLOSING_FRAMES);
  });
});

describe("no hard-coded colours leak (sentinel theme)", () => {
  it("Opening / Interlude / Closing / topic headline use only theme values", () => {
    for (const n of [2, 4, 6]) {
      const s = specN(n);
      for (const f of [0, 40, 100, 150, 240, 290]) assertThemed(html(<Opening spec={s} />, sentinel, f));
      for (const f of [0, 20, 50, 90, 119]) for (const d of [1, n]) assertThemed(html(<Interlude spec={s} done={d} />, sentinel, f));
      for (const f of [0, 150, 200, 240, 300, 390, 440, 479]) assertThemed(html(<Closing spec={s} scenes={scenesN(n)} />, sentinel, f));
    }
  });
  it("the demo story only draws theme values", () => {
    const { component: Story, timeline } = composeStory(demoSpec, demoScenes);
    for (const e of timeline) for (const k of [3, 40, 90, e.durationInFrames - 1]) assertThemed(html(<Story />, sentinel, e.from + Math.min(k, e.durationInFrames - 1)));
  });
  it("sentinel colours actually show up", () => {
    const out = html(<Closing spec={specN(3)} scenes={scenesN(3)} />, sentinel, 150);
    for (const needle of [C(11), C(31), C(61), C(141), "SentinelFont"]) expect(out).toContain(needle);
  });
});

describe("validación de la configuración y de las escenas", () => {
  const scenes = (...ids: string[]): TopicScene[] => ids.map((id) => ({ id, component: () => <div />, durationInFrames: 100 }));
  it("rechaza ids de escena repetidos", () => {
    expect(() => composeStory(specN(2), scenes("a", "a"))).toThrow(/repetido/);
  });
  it("rechaza ids reservados (opening, closing, interlude-N)", () => {
    for (const id of ["opening", "closing", "interlude-3", "interlude"]) {
      expect(() => composeStory(specN(2), scenes(id, "ok")), id).toThrow(/reservado/);
    }
  });
  it("rechaza duraciones no enteras o no positivas", () => {
    for (const d of [90.5, 0, -10, NaN, Infinity]) {
      const sc = scenes("a", "b");
      sc[0]!.durationInFrames = d;
      expect(() => composeStory(specN(2), sc), String(d)).toThrow(/entero > 0/);
    }
  });
  it("rechaza timing no entero, menor a 60 o con claves desconocidas", () => {
    expect(() => validateSpec(specN(2, { timing: { opening: 90.5 } }))).toThrow(/entero/);
    expect(() => validateSpec(specN(2, { timing: { closing: 30 } }))).toThrow(/>= 60/);
    expect(() => validateSpec(specN(2, { timing: { openning: 100 } as never }))).toThrow(/timing\.openning no existe/);
  });
  it("labels: ausente o vacío usa los nombres de los temas; mal formado se rechaza", () => {
    const sin = { ...specN(2) } as Partial<StorySpec>;
    delete sin.labels;
    expect(() => validateSpec(sin as StorySpec)).not.toThrow();
    expect(() => html(<Opening spec={sin as StorySpec} />, neutral, 20)).not.toThrow();
    expect(() => composeStory(sin as StorySpec, scenesN(2))).not.toThrow();
    expect(labelAt(undefined, 0, ["x", "y"])).toBe("x");
    expect(() => validateSpec(specN(2, { labels: "uno" as never }))).toThrow(/lista de textos/);
    expect(() => validateSpec(specN(2, { labels: ["ok", ""] }))).toThrow(/labels\[1\]/);
    expect(() => validateSpec(specN(2, { labels: ["ok", 3 as never] }))).toThrow(/labels\[1\]/);
  });
  it("el contador de las vueltas al listado sale del índice, no del id", () => {
    const { timeline, component: Story } = composeStory(specN(3), scenes("interludes", "opening2", "x-1"));
    expect(timeline.filter((e) => e.kind === "interlude").map((e) => e.id)).toEqual(["interlude-1", "interlude-2", "interlude-3"]);
    for (const e of timeline) expect(html(<Story />, neutral, e.from + 5)).not.toContain("NaN");
  });
});

describe("labelAt y fitText", () => {
  it("no repite vecinas (i con i+1, y con i+6 si hay 3 o más) para n = 2..12", () => {
    for (let n = 2; n <= 12; n++) {
      const pool = Array.from({ length: n }, (_, k) => `e${k}`);
      for (let i = 0; i < 200; i++) {
        expect(labelAt(pool, i, []), `n=${n} i=${i} (al lado)`).not.toBe(labelAt(pool, i + 1, []));
        if (n >= 3) expect(labelAt(pool, i, []), `n=${n} i=${i} (abajo)`).not.toBe(labelAt(pool, i + 6, []));
      }
    }
  });
  it("cuenta caracteres, no unidades UTF-16", () => {
    const emoji = "😀".repeat(10);
    expect(textWidth(emoji, 10)).toBeCloseTo(10 * 0.56 * 10);
    const r = fitText(emoji, 60, 40, { min: 40 });
    expect(Array.from(r.text).every((c) => c === "😀" || c === "…")).toBe(true);
  });
});

describe("formatos vertical y cuadrado", () => {
  const FORMATS: [number, number][] = [[1080, 1920], [1080, 1080]];
  it("los paneles del cierre entran en el cuadro, sin pisarse, de 2 a 6 temas", () => {
    for (const [w, h] of FORMATS) {
      for (let n = 2; n <= 6; n++) {
        const p = panelLayout(n, w, h);
        expect(p).toHaveLength(n);
        for (const q of p) {
          expect(q.x - 280 * q.k).toBeGreaterThanOrEqual(0);
          expect(q.x + 280 * q.k).toBeLessThanOrEqual(w);
          expect(q.y - 170 * q.k - 50).toBeGreaterThanOrEqual(0);
          expect(q.y + 170 * q.k).toBeLessThanOrEqual(h);
        }
        for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
          const overlapX = Math.abs(p[a]!.x - p[b]!.x) < 280 * (p[a]!.k + p[b]!.k);
          const overlapY = Math.abs(p[a]!.y - p[b]!.y) < 170 * (p[a]!.k + p[b]!.k);
          expect(overlapX && overlapY).toBe(false);
        }
      }
    }
  });
  it("los lugares del cierre y la lista caben, y el muro esquiva los lugares", () => {
    for (const [w, h] of FORMATS) {
      for (let n = 2; n <= 6; n++) {
        const slots = reservedSlots(n, w, h);
        expect(slots).toHaveLength(n);
        for (const s of slots) expect(Math.abs(s.y)).toBeLessThan(h / 2 / 0.8);
        const { inner } = closingWall(specN(n), w, h);
        for (const c of inner) for (const s of slots) expect(Math.abs(c.x - s.x) < 480 && Math.abs(c.y - s.y) < 120).toBe(false);
        const L = listLayout(specN(n), neutral, w, h);
        expect(L.left).toBeGreaterThanOrEqual(0);
        expect(L.left + L.rowW).toBeLessThanOrEqual(w - (h / w > 1.3 ? w * 0.08 : neutral.safe.x) + 1); // en vertical la lista usa más ancho que el seguro
        expect(L.top + n * L.rowH).toBeLessThanOrEqual(h);
      }
    }
  });
  it("story-demo declara los formatos y las escenas de la línea de tiempo", () => {
    expect(Object.keys(storyDemo.formatSizes!)).toEqual(["horizontal", "vertical", "cuadrado"]);
    expect(storyDemo.formatSizes!.vertical).toEqual({ width: 1080, height: 1920 });
    expect(storyDemo.scenes!.map((s) => s.id)).toEqual(["opening", "ventas", "interlude-1", "inventario", "interlude-2", "atencion", "interlude-3", "closing"]);
    expect(storyDemo.scenes![1]).toMatchObject({ name: "Panel de ventas", from: 300, durationInFrames: 150 });
  });
});
