import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider, Sequence, useFrame } from "../engine";
import { Wash } from "../kit";
import { ThemeProvider, neutral } from "../themes";
import { BackdropLayer, StoryStage, composeStory } from "./index";
import type { StorySpec, TopicScene } from "./index";

// Ranura de fondo global (`spec.backdrop`): aparece en todos los bloques con el cuadro absoluto, sobre el fondo y bajo el contenido, también bajo el velo.

const SPEC: StorySpec = {
  title: { text: "Prueba de la ranura" },
  topics: [{ id: "a", name: "Primero", line: "uno" }, { id: "b", name: "Segundo", line: "dos" }],
  labels: ["Uno", "Dos"],
  signoff: { text: "Chau" },
};
const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 2000 };
const html = (el: React.ReactElement, frame: number) => renderToStaticMarkup(<FrameProvider frame={frame} config={config}><ThemeProvider theme={neutral}>{el}</ThemeProvider></FrameProvider>);

/** Marca con el cuadro que ve; un `data-f` distinto por cuadro absoluto delata si leyó el relativo. */
const Marca = () => <i data-fondo={useFrame()} />;
const Escena = () => <><b data-escena="1" style={{ position: "absolute" }}>contenido</b><Wash range={[40, 59]} /></>;
const scenes: TopicScene[] = [{ id: "a", component: Escena, durationInFrames: 60 }, { id: "b", component: Escena, durationInFrames: 60 }];

const build = (backdrop?: StorySpec["backdrop"]) => composeStory({ ...SPEC, ...(backdrop !== undefined ? { backdrop } : {}) }, scenes);
const frameOf = (id: string, k: number, tl: ReturnType<typeof composeStory>["timeline"]) => tl.find((e) => e.id === id)!.from + k;

describe("ranura backdrop", () => {
  it("sin ranura el marcado es el de siempre (sin marcas de adorno ni capas nuevas)", () => {
    const { component: C, timeline } = build();
    const out = html(<C />, frameOf("a", 10, timeline));
    expect(out).not.toContain("data-qa-decor");
    expect(out).not.toContain("data-fondo");
  });

  it("aparece en todos los bloques y lee el cuadro absoluto", () => {
    const { component: C, timeline } = build(<Marca />);
    for (const e of timeline) {
      const f = e.from + 5;
      const out = html(<C />, f);
      expect(out, e.id).toContain(`data-fondo="${f}"`);
    }
  });

  it("acepta un componente sin props", () => {
    const { component: C, timeline } = build(Marca);
    expect(html(<C />, frameOf("b", 3, timeline))).toContain(`data-fondo="${frameOf("b", 3, timeline)}"`);
  });

  it("está sobre el fondo y bajo el contenido, y marcada como adorno", () => {
    const { component: C, timeline } = build(<Marca />);
    const out = html(<C />, frameOf("a", 10, timeline));
    const iFondo = out.indexOf("data-fondo");
    expect(out.lastIndexOf("data-qa-decor", iFondo)).toBeGreaterThan(-1);
    expect(out.indexOf('data-qa-ignore="covered vacio"')).toBeGreaterThan(-1);
    expect(iFondo).toBeGreaterThan(out.indexOf("background:")); // después del fondo del escenario
    expect(iFondo).toBeLessThan(out.indexOf("data-escena")); // antes que el contenido
  });

  it("durante el velo de la escena la ranura también va dentro del velo, con el cuadro absoluto", () => {
    const { component: C, timeline } = build(<Marca />);
    const f = frameOf("a", 50, timeline);
    const out = html(<C />, f);
    const veil = out.indexOf("data-qa-veil");
    expect(veil).toBeGreaterThan(-1);
    expect(out.indexOf(`data-fondo="${f}"`, veil)).toBeGreaterThan(veil);
    // con el velo cerrado del todo también
    const full = html(<C />, frameOf("a", 59, timeline) - 0);
    expect(full.indexOf(`data-fondo=`, full.indexOf("data-qa-veil"))).toBeGreaterThan(-1);
  });

  it("también en el velo de la apertura, la vuelta y el telón del cierre", () => {
    const { component: C, timeline } = build(<Marca />);
    for (const id of ["opening", "interlude-1", "closing"]) {
      const e = timeline.find((x) => x.id === id)!;
      let found = false;
      for (let k = 0; k < e.durationInFrames && !found; k += 2) {
        const out = html(<C />, e.from + k);
        const v = out.indexOf("data-qa-veil");
        if (v >= 0 && out.indexOf("data-fondo", v) > v) found = true;
      }
      expect(found, id).toBe(true);
    }
  });

  it("fuera de la historia: BackdropLayer con cuadro absoluto dentro de una Sequence", () => {
    const out = html(<StoryStage><Sequence from={100}><BackdropLayer><Marca /></BackdropLayer></Sequence></StoryStage>, 130);
    expect(out).toContain('data-fondo="130"');
    expect(out).toContain("data-qa-decor");
  });

  it("es pura: el mismo cuadro da el mismo marcado", () => {
    const { component: C, timeline } = build(<Marca />);
    const f = frameOf("interlude-1", 30, timeline);
    expect(html(<C />, f)).toBe(html(<C />, f));
  });
});
