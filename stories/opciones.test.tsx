import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider, Sequence } from "../engine";
import { ThemeProvider, neutral } from "../themes";
import { Closing, DefaultThumbnail, Interlude, InterludeCompact, Opening, TopicHeadline, TopicProvider, composeStory, nextTopic, parseRich, plainRich, storyBudget, useTopic, validateSpec } from "./index";
import type { StorySpec, TopicScene } from "./index";
import { listLayout, openingWall } from "./layout";
import { pillNumberColor, quietOpacity } from "./shared";
import { contrastRatio, dark, editorial, neon, papel, storyDefaults } from "../themes";
import { resolveStoryDesign } from "./shared";

const spec = (over: Partial<StorySpec> = {}): StorySpec => ({
  title: { text: "Título de prueba", highlight: "prueba" },
  topics: [
    { id: "a", name: "Primer tema", line: "línea del primero" },
    { id: "b", name: "Segundo tema", line: "línea del segundo" },
    { id: "c", name: "Tercer tema", line: "línea del tercero" },
    { id: "d", name: "Cuarto tema", line: "línea del cuarto" },
  ],
  labels: ["Uno", "Dos", "Tres"],
  signoff: { text: "Chau", tagline: "Nota" },
  ...over,
});
const scene = (id: string, dur = 90): TopicScene => ({ id, component: () => <div>escena {id}</div>, durationInFrames: dur });
const html = (node: React.ReactNode, frame: number, durationInFrames = 2000, theme = neutral) =>
  renderToString(
    <FrameProvider frame={frame} config={{ fps: 30, width: 1920, height: 1080, durationInFrames }}>
      <ThemeProvider theme={theme}>{node}</ThemeProvider>
    </FrameProvider>,
  );

describe("temas sin escena", () => {
  it("composeStory acepta null: sin escena ni vuelta para ese tema, el resto igual", () => {
    const { timeline, durationInFrames } = composeStory(spec(), [scene("a"), null, scene("c"), null]);
    expect(timeline.map((e) => e.id)).toEqual(["opening", "a", "interlude-1", "c", "interlude-2", "closing"]);
    expect(timeline.map((e) => e.topic)).toEqual([undefined, 0, 0, 2, 2, undefined]);
    // contiguo y sin huecos
    let at = 0;
    for (const e of timeline) { expect(e.from).toBe(at); at += e.durationInFrames; }
    expect(durationInFrames).toBe(at);
  });
  it("una lista vacía vale por ningún tema con escena: solo apertura y cierre", () => {
    const { timeline } = composeStory(spec(), []);
    expect(timeline.map((e) => e.kind)).toEqual(["opening", "closing"]);
    expect(composeStory(spec(), [null, null, null, null]).timeline.map((e) => e.kind)).toEqual(["opening", "closing"]);
  });
  it("la cantidad de escenas tiene que coincidir con la de temas (salvo la lista vacía)", () => {
    expect(() => composeStory(spec(), [scene("a")])).toThrow(/usá null/);
  });
  it("el presupuesto cuenta una vuelta por escena", () => {
    const b = storyBudget(spec(), [90, null, 90, null]);
    expect(b.interlude.count).toBe(2);
    expect(b.scenes.each).toEqual([90, 90]);
    expect(storyBudget(spec()).interlude.count).toBe(4);
    expect(storyBudget(spec(), []).interlude.count).toBe(0);
  });
  it("nextTopic salta los temas sin escena", () => {
    expect(nextTopic(4, 1, [1])).toBe(2);
    expect(nextTopic(4, 3, [3])).toBe(-1);
    expect(nextTopic(4, 4)).toBe(-1);
  });
  it("la vuelta no tilda los temas sin escena y no los marca como siguientes", () => {
    const withSkip = html(<Interlude spec={spec()} done={1} skip={[1]} />, 100, 120);
    const without = html(<Interlude spec={spec()} done={1} />, 100, 120);
    expect(withSkip).not.toBe(without);
    // en la compacta la tira cuenta solo los temas con escena: "Sigue · 2 de 2"
    expect(html(<InterludeCompact spec={spec()} done={1} skip={[1, 3]} />, 30, 40)).toContain("Sigue · 2 de 2");
    expect(html(<InterludeCompact spec={spec()} done={3} skip={[1, 3]} />, 30, 40)).toContain("Sigue el resumen");
  });
  it("el cierre suelto acepta null o ninguna escena y usa la miniatura del tema", () => {
    const Thumb = () => <div>miniatura propia</div>;
    const s = spec({ topics: spec().topics.map((t, i) => (i === 1 ? { ...t, thumbnail: Thumb } : t)) });
    expect(html(<Closing spec={s} />, 100, 480)).toContain("miniatura propia");
    expect(html(<Closing spec={s} scenes={[null, null, null, null]} />, 100, 480)).toContain("miniatura propia");
  });
  it("Opening y Closing se componen a mano con Sequence y TopicProvider", () => {
    const s = spec();
    const Mine = () => <TopicHeadline start={0} />;
    const node = (
      <>
        <Sequence from={0} durationInFrames={300}><Opening spec={s} /></Sequence>
        <Sequence from={300} durationInFrames={90}><TopicProvider spec={s} index={2}><Mine /></TopicProvider></Sequence>
        <Sequence from={390} durationInFrames={480}><Closing spec={s} /></Sequence>
      </>
    );
    expect(html(node, 350)).toContain("Tercer tema");
    expect(html(node, 350)).toContain(">03<");
  });
  it("useTopic dentro de TopicProvider devuelve el tema; con índice inválido lanza", () => {
    const Probe = () => <span>{useTopic().name}</span>;
    expect(html(<TopicProvider spec={spec()} index={1}><Probe /></TopicProvider>, 0)).toContain("Segundo tema");
    expect(() => html(<TopicProvider spec={spec()} index={9}><Probe /></TopicProvider>, 0)).toThrow(/no existe/);
  });
});

describe("opciones de diseño", () => {
  it("validan sus valores con errores en español", () => {
    expect(() => validateSpec(spec({ design: { titleCard: "vidrio" as never } }))).toThrow(/design.titleCard/);
    expect(() => validateSpec(spec({ design: { list: "fila" as never } }))).toThrow(/design.list/);
    expect(() => validateSpec(spec({ design: { handoff: "corte" as never } }))).toThrow(/design.handoff/);
    expect(() => validateSpec(spec({ design: { wall: { columns: 1 } } }))).toThrow(/wall.columns/);
    expect(() => validateSpec(spec({ design: { wall: { blur: "si" as never } } }))).toThrow(/wall.blur/);
    expect(() => validateSpec(spec({ design: { otra: 1 } as never }))).toThrow(/otra no existe/);
    expect(() => validateSpec(spec({ design: { titleCard: "glass", list: "inline", handoff: "dock", wall: { columns: 5, rows: 4, blur: false }, clouds: { opacity: 0.3 } } }))).not.toThrow();
  });
  it("el vidrio es una superficie semiopaca (sin backdrop-filter, que no es determinista)", () => {
    const solid = html(<Opening spec={spec()} />, 40, 300);
    const glass = html(<Opening spec={spec({ design: { titleCard: "glass" } })} />, 40, 300);
    expect(glass).not.toBe(solid);
    expect(glass).not.toContain("backdrop-filter");
  });
  it("el muro por defecto es el de siempre (36 piezas) y columnas × filas lo cambia", () => {
    expect(openingWall(spec(), 1080, 1920)).toHaveLength(36);
    expect(openingWall(spec({ design: { wall: { columns: 8, rows: 4 } } }), 1080, 1920)).toHaveLength(32);
    expect(openingWall(spec({ design: { wall: { columns: 2, rows: 3 } } }), 1920, 1080)).toHaveLength(6);
    // las primeras piezas conservan su azar (mismo `random(x${i})`): el reparto por defecto no cambia
    expect(openingWall(spec(), 1080, 1920)[7]).toEqual(openingWall(spec({ design: { wall: {} } }), 1080, 1920)[7]);
  });
  it("wall.blur false saca el desenfoque por distancia de las piezas", () => {
    const blurred = html(<Opening spec={spec()} />, 3, 300);
    const sharp = html(<Opening spec={spec({ design: { wall: { blur: false } } })} />, 3, 300);
    // (las nubes llevan siempre su blur(110px))
    expect(blurred).toMatch(/filter:blur\((?!110px)/);
    expect(sharp).not.toMatch(/filter:blur\((?!110px)/);
  });
  it("la lista en un renglón mide menos de alto por fila y lleva el separador; en vertical se ignora", () => {
    const inline = listLayout(spec({ design: { list: "inline" } }), neutral, 1920, 1080);
    const stacked = listLayout(spec(), neutral, 1920, 1080);
    expect(inline.inline).toBe(true);
    expect(inline.blockH).toBeLessThan(stacked.blockH);
    expect(inline.lines.every((l) => l.length > 0)).toBe(true);
    expect(listLayout(spec({ design: { list: "inline" } }), neutral, 1080, 1920).inline).toBeUndefined();
    const out = html(<Opening spec={spec({ design: { list: "inline" } })} />, 200, 300);
    expect(out).toContain("·");
    expect(out).toContain("línea del primero");
  });
  it("el acople dibuja la píldora del tema y no el velo; la escena arranca con la píldora ya puesta", () => {
    const s = spec({ design: { handoff: "dock" } });
    const end = html(<Opening spec={s} />, 299, 300);
    expect(end).toContain("Primer tema");
    expect(end).not.toContain("data-qa-veil");
    expect(html(<Opening spec={spec()} />, 299, 300)).toContain("data-qa-veil");
    // `first` elige el tema que se acopla
    expect(html(<Opening spec={s} first={2} />, 299, 300)).toContain("Tercer tema");
    // la escena: con `docked` la píldora está completa en el cuadro 0 (sin transform ni opacity de entrada)
    const docked = html(<TopicProvider spec={s} index={0} docked><TopicHeadline start={4} /></TopicProvider>, 0);
    const normal = html(<TopicProvider spec={s} index={0}><TopicHeadline start={4} /></TopicProvider>, 0);
    expect(docked).toContain("Primer tema");
    expect(normal).not.toContain("Primer tema");
  });
  it("composeStory acopla al primer tema con escena", () => {
    const s = spec({ design: { handoff: "dock" } });
    const { component: Story } = composeStory(s, [null, scene("b"), scene("c"), null]);
    expect(html(<Story />, 299, 3000)).toContain("Segundo tema");
  });
  it("las nubes de design.clouds llegan al fondo de todos los bloques", () => {
    const s = spec({ design: { clouds: { blobs: [{ x: 0.5, y: 0.5, size: 777 }], opacity: 0.61 } } });
    for (const node of [<Opening spec={s} />, <Interlude spec={s} done={1} />, <InterludeCompact spec={s} done={1} />, <Closing spec={s} />]) {
      const out = html(node, 20, 600);
      expect(out).toContain("width:777px");
      expect(out).toContain("opacity:0.61");
    }
  });
});

describe("firma", () => {
  it("signoff.text es opcional con logo o slot; sin ninguno de los tres, error", () => {
    expect(() => validateSpec(spec({ signoff: { slot: <i /> } }))).not.toThrow();
    expect(() => validateSpec(spec({ signoff: { logo: "x.png" } }))).not.toThrow();
    expect(() => validateSpec(spec({ signoff: { tagline: "solo nota" } }))).toThrow(/signoff.text/);
  });
  it("texto rico: un fragmento en negrita entre dobles asteriscos", () => {
    expect(parseRich("Gracias por **mirar** hoy")).toEqual([{ text: "Gracias por ", bold: false }, { text: "mirar", bold: true }, { text: " hoy", bold: false }]);
    expect(parseRich("sin marcas")).toEqual([{ text: "sin marcas", bold: false }]);
    expect(plainRich("a **b** c")).toBe("a b c");
    const out = html(<Closing spec={spec({ signoff: { text: "Gracias por **mirar**" } })} />, 470, 480);
    expect(out).toContain("<strong");
    expect(out).toContain(">mirar</strong>");
    expect(out).not.toContain("**");
  });
  it("sin texto la marca entra sola (sin renglón de despedida)", () => {
    const out = html(<Closing spec={spec({ signoff: { slot: <b data-x="marca">M</b>, tagline: "nota" } })} />, 470, 480);
    expect(out).toContain('data-x="marca"');
    expect(out).toContain("nota");
    expect(out).not.toContain("Chau");
  });
  it("el logo, el texto y la nota quedan con visibility hidden mientras su opacidad es 0 y en reposo no lo llevan", () => {
    const s = spec({ signoff: { slot: <b>M</b>, text: "Chau", tagline: "nota" } });
    const early = html(<Closing spec={s} />, 100, 480);
    const sign = early.slice(early.indexOf("z-index:600"));
    expect(sign).toContain("visibility:hidden");
    const end = html(<Closing spec={s} />, 479, 480);
    expect(end.slice(end.indexOf("z-index:600"))).not.toContain("visibility:hidden");
  });
  it("el número de la píldora tiene contraste suficiente sobre la superficie en cualquier tema", () => {
    for (const t of [neutral, dark]) expect(contrastRatio(pillNumberColor(t), t.color.surface)).toBeGreaterThanOrEqual(4.5);
    // un tema con acentos pálidos cae al color de texto
    const pale = { ...neutral, color: { ...neutral.color, accent: "#ffee99", accent2: "#ffeeaa" } };
    expect(pillNumberColor(pale)).toBe(pale.color.text);
  });
});

/** Marcado de la píldora del titular (el `div` con z-index 90) dentro de un fragmento. */
function pillMarkup(markup: string): string {
  const at = markup.indexOf("z-index:90");
  expect(at).toBeGreaterThan(0);
  const start = markup.lastIndexOf("<div", at);
  let depth = 0;
  for (let i = start; i < markup.length; ) {
    const open = markup.indexOf("<div", i), close = markup.indexOf("</div>", i);
    if (open !== -1 && open < close) { depth++; i = open + 4; } else { depth--; i = close + 6; if (depth === 0) return markup.slice(start, i); }
  }
  throw new Error("píldora sin cerrar");
}

describe("segunda migración: píldora acoplada, opciones y contrastes", () => {
  const variants: [string, Partial<StorySpec>][] = [
    ["apilada", { design: { handoff: "dock" } }],
    ["en un renglón", { design: { handoff: "dock", list: "inline" } }],
    ["en un renglón con forma larga", { design: { handoff: "dock", list: { layout: "inline", underline: "name" } } }],
    ["chica", { design: { handoff: "dock", headline: { size: "sm" }, list: "inline" } }],
  ];
  for (const [name, over] of variants) {
    it(`la píldora del último cuadro de la apertura es idéntica a la del primero de la escena (${name})`, () => {
      const s = spec(over);
      const end = pillMarkup(html(<Opening spec={s} />, 299, 300));
      const first = pillMarkup(html(<TopicProvider spec={s} index={0} docked><TopicHeadline start={4} /></TopicProvider>, 0));
      expect(end).toBe(first);
      // y también la que arma composeStory
      const withHead = (id: string): TopicScene => ({ id, component: () => <TopicHeadline start={4} />, durationInFrames: 90 });
      const { component: Story, timeline } = composeStory(s, [withHead("a"), withHead("b"), withHead("c"), withHead("d")]);
      const inScene = pillMarkup(html(<Story />, timeline[1]!.from, 3000));
      expect(inScene).toBe(first);
    });
  }
  it("en renglón lleva la línea del tema; apilada, solo el título; el tamaño chico achica la letra", () => {
    const inline = html(<TopicProvider spec={spec({ design: { list: "inline" } })} index={0}><TopicHeadline start={-20} /></TopicProvider>, 0);
    expect(pillMarkup(inline)).toContain("línea del primero");
    expect(pillMarkup(html(<TopicProvider spec={spec()} index={0}><TopicHeadline start={-20} /></TopicProvider>, 0))).not.toContain("línea del primero");
    // props explícitas pisan al diseño
    expect(pillMarkup(html(<TopicProvider spec={spec()} index={0}><TopicHeadline start={-20} layout="inline" subtitle="otra" /></TopicProvider>, 0))).toContain("otra");
    const size = (m: string) => Number(/font-size:([\d.]+)px/.exec(m)![1]);
    const md = pillMarkup(html(<TopicProvider spec={spec()} index={0}><TopicHeadline start={-20} /></TopicProvider>, 0));
    const sm = pillMarkup(html(<TopicProvider spec={spec({ design: { headline: { size: "sm" } } })} index={0}><TopicHeadline start={-20} /></TopicProvider>, 0));
    expect(size(sm)).toBeLessThan(size(md));
    expect(pillMarkup(html(<TopicProvider spec={spec()} index={0}><TopicHeadline start={-20} size="sm" /></TopicProvider>, 0))).toBe(sm);
  });
  it("el reposo de la píldora por defecto no cambió (apilada, medio, sin degradado en movimiento)", () => {
    const m = pillMarkup(html(<TopicProvider spec={spec()} index={1}><TopicHeadline start={-20} /></TopicProvider>, 0));
    expect(m).toContain(">02<");
    expect(m).toContain("background-size:100% 100%");
  });
  it("las filas atenuadas conservan el contraste con nubes fuertes del tema (no solo de design.clouds)", () => {
    const strong = { ...neutral, cloud: { ...neutral.cloud, opacity: 0.35 } };
    expect(quietOpacity(neutral, undefined, 0.75)).toBe(0.75);
    expect(quietOpacity(dark, undefined, 0.75)).toBe(0.75);
    const q = quietOpacity(strong, undefined, 0.75);
    expect(q).toBeGreaterThan(0.75);
    // design.clouds pisa al tema: con nubes tenues vuelve a la base
    expect(quietOpacity(strong, { opacity: 0.1 }, 0.75)).toBe(0.75);
    // la cuenta: texto atenuado a `q` sobre el peor fondo llega a 4,5
    const out = html(<Interlude spec={spec()} done={2} />, 50, 120, strong);
    expect(out).toContain(`opacity:${q}`);
  });
  it("la tarjeta por defecto del cierre tiene el número con contraste en un tema neutro, oscuro y de acentos pálidos", () => {
    const pale = { ...neutral, color: { ...neutral.color, accent: "#ffee99", accent2: "#ffeeaa", chart: ["#ffee99", "#ffeeaa", "#ffeebb", "#ffeecc", "#ffeedd", "#ffeeee"] as typeof neutral.color.chart } };
    for (const t of [neutral, dark, pale]) {
      for (let i = 0; i < 4; i++) {
        const out = html(<DefaultThumbnail index={i} name="Tema" />, 0, 60, t);
        const m = new RegExp(`color:([^;"]+)">0${i + 1}<`).exec(out);
        expect(m, `tema ${t.name} índice ${i}`).not.toBeNull();
        expect(contrastRatio(m![1]!, t.color.surfaceAlt)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("tema sin escena: se ve plano (atenuado, sin tilde, nunca el siguiente); con seen se tilda desde el principio", () => {
    const s = spec();
    const plain = html(<Interlude spec={s} done={1} skip={[1]} />, 100, 120);
    expect(plain).not.toContain("story-check-1");
    expect(plain).toContain("story-check-0");
    const seen = spec({ topics: s.topics.map((t, i) => (i === 1 ? { ...t, seen: true } : t)) });
    const ticked = html(<Interlude spec={seen} done={1} skip={[1]} />, 100, 120);
    expect(ticked).toContain("story-check-1");
    // el primero ya visto y el sin escena con seen: ambos tildados; el siguiente (índice 2) no
    expect(ticked).not.toContain("story-check-2");
    // lista parcial "01, 02 (sin escena), 03": al mostrar el 03 el 02 no queda como pendiente
    const late = html(<Interlude spec={s} done={3} skip={[1]} />, 100, 120);
    expect(late).toContain("story-check-0");
    expect(late).toContain("story-check-2");
    expect(late).not.toContain("story-check-1");
    expect(() => validateSpec(spec({ topics: s.topics.map((t, i) => (i === 0 ? { ...t, seen: "si" as never } : t)) }))).toThrow(/seen/);
  });
  it("wall: chipScale, depth y dolly; el desenfoque se decide por bloque", () => {
    const base = openingWall(spec(), 1080, 1920);
    const big = openingWall(spec({ design: { wall: { chipScale: 1.5, depth: 0 } } }), 1080, 1920);
    expect(big[0]!.k).toBeCloseTo(base[0]!.k * 1.5, 5);
    expect(big.every((c) => c.z === 0)).toBe(true);
    expect(openingWall(spec({ design: { wall: { chipScale: 1, depth: 1, dolly: 0 } } }), 1920, 1080)).toEqual(openingWall(spec(), 1920, 1080));
    const a = html(<Opening spec={spec()} />, 60, 300), b = html(<Opening spec={spec({ design: { wall: { dolly: 600 } } })} />, 60, 300);
    expect(b).not.toBe(a);
    expect(html(<Opening spec={spec({ design: { wall: { dolly: 0 } } })} />, 60, 300)).toBe(a);
    const blurOf = (o: StorySpec["design"], node: (s: StorySpec) => React.ReactNode, f: number, d: number) => /filter:blur\((?!110px)/.test(html(node(spec({ design: o })), f, d));
    expect(blurOf({ wall: { blur: { opening: false } } }, (s) => <Opening spec={s} />, 3, 300)).toBe(false);
    expect(blurOf({ wall: { blur: { opening: false } } }, (s) => <Closing spec={s} />, 10, 480)).toBe(true);
    expect(blurOf({ wall: { blur: { closing: false } } }, (s) => <Closing spec={s} />, 10, 480)).toBe(false);
    expect(blurOf({ wall: { blur: { closing: false } } }, (s) => <Opening spec={s} />, 3, 300)).toBe(true);
    expect(() => validateSpec(spec({ design: { wall: { blur: { opening: 1 as never } } } }))).toThrow(/wall.blur/);
    expect(() => validateSpec(spec({ design: { wall: { chipScale: 9 } } }))).toThrow(/chipScale/);
  });
  it("list acepta la forma corta y el objeto; underline name acorta el subrayado al nombre", () => {
    const noFn = (L: ReturnType<typeof listLayout>) => JSON.stringify(L);
    const row = listLayout(spec(), neutral, 1920, 1080);
    expect(noFn(listLayout(spec({ design: { list: { layout: "stacked", underline: "row" } } }), neutral, 1920, 1080))).toBe(noFn(row));
    expect(noFn(listLayout(spec({ design: { list: { layout: "inline" } } }), neutral, 1920, 1080))).toBe(noFn(listLayout(spec({ design: { list: "inline" } }), neutral, 1920, 1080)));
    const byName = listLayout(spec({ design: { list: { underline: "name" } } }), neutral, 1920, 1080);
    expect(byName.barWs.every((w, i) => w < row.barWs[i]!)).toBe(true);
    expect(() => validateSpec(spec({ design: { list: { underline: "x" as never } } }))).toThrow(/list.underline/);
    expect(() => validateSpec(spec({ design: { list: { otra: 1 } as never } }))).toThrow(/list.otra/);
  });
  it("handoff through: sin velo, nubes continuas y la escena entra por su cuenta", () => {
    const s = spec({ design: { handoff: "through" } });
    const end = html(<Opening spec={s} />, 299, 300);
    expect(end).not.toContain("data-qa-veil");
    expect(html(<Opening spec={spec()} />, 299, 300)).toContain("data-qa-veil");
    const { component: Story, timeline } = composeStory(s, [null, scene("b"), scene("c"), null]);
    expect(html(<Story />, timeline[1]!.from, 3000)).not.toContain("Segundo tema");
    expect(() => validateSpec(spec({ design: { handoff: "corte" as never } }))).toThrow(/wash", "dock" o "through"|design.handoff/);
  });
  it("gradient.loop mueve el degradado de los textos de la historia; sin él queda quieto", () => {
    const pos = (s: StorySpec, f: number) => [...html(<Opening spec={s} />, f, 300).matchAll(/background-position:([^;"]+)/g)].map((m) => m[1]).join("|");
    const still = spec(), loop = spec({ design: { gradient: { loop: 40 } } });
    expect(pos(still, 200)).toBe(pos(still, 220));
    expect(pos(loop, 200)).not.toBe(pos(loop, 210));
    expect(pos(loop, 200)).toBe(pos(loop, 240)); // vuelve al mismo punto cada `loop` cuadros
    expect(() => validateSpec(spec({ design: { gradient: { loop: 1 } } }))).toThrow(/gradient.loop/);
  });
  it("closing.bg elige un rol del tema para el fondo de la firma; por defecto, bg", () => {
    const wash = (s: StorySpec, t = neutral) => /background:([^;"]+);opacity:[^;"]*;z-index:500|background:([^;"]+);z-index:500/.exec(html(<Closing spec={s} />, 470, 480, t));
    const def = wash(spec());
    expect(def![1] ?? def![2]).toBe(neutral.color.bg);
    const surf = wash(spec({ design: { closing: { bg: "surface" } } }));
    expect(surf![1] ?? surf![2]).toBe(neutral.color.surface);
  });
});

describe("el diseño del video y el del design system", () => {
  it("un video que no indica nada recibe el estilo de historias del design system", () => {
    const d = resolveStoryDesign(editorial, undefined, 1920, 1080);
    expect(d.handoff).toBe("dock");
    expect(d.list).toEqual({ layout: "inline", underline: "name" });
    expect(d.headline?.size).toBe("sm");
    expect(d.closing).toEqual({ bg: "surface", bar: false });
    expect(d.wall).toMatchObject({ columns: 5, rows: 6, chipScale: 0.9, depth: 0.5, blur: { opening: true, closing: false } });
    expect(resolveStoryDesign(neon, undefined, 1920, 1080).gradient).toEqual({ loop: 90 });
  });
  it("el diseño del video pisa al del tema, opción por opción", () => {
    const d = resolveStoryDesign(editorial, { handoff: "wash", list: "stacked", wall: { columns: 3, blur: false }, closing: { bar: true } }, 1920, 1080);
    expect(d.handoff).toBe("wash");
    expect(d.list).toEqual({ layout: "stacked", underline: "name" }); // lo que el video no dice sale del tema
    expect(d.wall).toMatchObject({ columns: 3, rows: 6, blur: { opening: false, closing: false } });
    expect(d.closing).toEqual({ bg: "surface", bar: true });
  });
  it("con el tema por defecto el diseño resuelto es el de siempre", () => {
    for (const t of [neutral, dark]) {
      const d = resolveStoryDesign(t, undefined, 1920, 1080);
      expect(d).toEqual(storyDefaults(t));
      expect(d.handoff).toBe("wash");
      expect(d.titleCard).toBe("solid");
      expect(d.wall).toEqual({ chipScale: 1, dolly: 0, depth: 1, gapX: 1, gapY: 1, brick: 1, jitter: 1, blur: { opening: true, closing: true } });
    }
  });
  it("en formato alto las columnas y filas del muro del tema no rigen; las del video sí", () => {
    expect(resolveStoryDesign(editorial, undefined, 1080, 1920).wall).not.toHaveProperty("columns");
    expect(resolveStoryDesign(editorial, { wall: { columns: 4 } }, 1080, 1920).wall).toMatchObject({ columns: 4 });
    expect(resolveStoryDesign(editorial, undefined, 1080, 1920).wall).not.toHaveProperty("rows");
  });
  it("closing.bar: valida y quita la marca de acento bajo la firma", () => {
    expect(() => validateSpec(spec({ design: { closing: { bar: "si" as never } } }))).toThrow(/closing.bar/);
    expect(() => validateSpec(spec({ design: { closing: { otra: 1 } as never } }))).toThrow(/closing.otra/);
    const on = html(<Closing spec={spec()} />, 470, 480);
    const off = html(<Closing spec={spec({ design: { closing: { bar: false } } })} />, 470, 480);
    expect(on).toContain("height:8px");
    expect(off).not.toContain("height:8px");
    // el tema editorial no dibuja la barra por defecto; el video la pide
    expect(html(<Closing spec={spec()} />, 470, 480, editorial)).not.toContain("linear-gradient(90deg");
    expect(html(<Closing spec={spec({ design: { closing: { bar: true } } })} />, 470, 480, editorial)).toContain("height:2px"); // el filete fino de editorial (`decor.accentThickness: 0.5`)
  });
  it("el mismo guion se ve distinto en cada design system (cartel, lista, fondo)", () => {
    const frame = (t: typeof neutral) => html(<Opening spec={spec()} />, 20, 300, t);
    const out = [neutral, editorial, neon, papel].map(frame);
    expect(new Set(out).size).toBe(4);
    expect(frame(editorial)).toContain("linear-gradient(to right"); // fondo de grilla
    expect(frame(neon)).toContain("radial-gradient(circle"); // fondo de puntos
  });
});
