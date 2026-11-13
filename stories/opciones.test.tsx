import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider, Sequence } from "../engine";
import { ThemeProvider, neutral } from "../themes";
import { Closing, Interlude, InterludeCompact, Opening, TopicHeadline, TopicProvider, composeStory, nextTopic, parseRich, plainRich, storyBudget, useTopic, validateSpec } from "./index";
import type { StorySpec, TopicScene } from "./index";
import { listLayout, openingWall } from "./layout";
import { pillNumberColor } from "./shared";
import { contrastRatio, dark } from "../themes";

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
