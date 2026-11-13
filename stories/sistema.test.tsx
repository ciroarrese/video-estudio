import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, editorial, neon, neutral, themeFromTokens } from "../themes";
import type { Theme } from "../themes";
import { Opening, validateSpec } from "./index";
import type { StorySpec } from "./index";
import { openingWall } from "./layout";
import { resolveStoryDesign } from "./shared";
import { random } from "../engine";

const spec = (design?: StorySpec["design"]): StorySpec => ({
  title: { text: "Título", highlight: "Título" },
  topics: [
    { id: "a", name: "Primer tema", line: "línea del primero" },
    { id: "b", name: "Segundo tema", line: "línea del segundo" },
    { id: "c", name: "Tercer tema", line: "línea del tercero" },
  ],
  labels: ["Uno", "Dos", "Tres"],
  signoff: { text: "Chau" },
  design,
});
const html = (node: React.ReactNode, frame: number, theme: Theme = neutral, w = 1920, h = 1080) =>
  renderToString(<FrameProvider frame={frame} config={{ fps: 30, width: w, height: h, durationInFrames: 2000 }}><ThemeProvider theme={theme}>{node}</ThemeProvider></FrameProvider>);

describe("muro de la apertura: separación, ladrillo y temblor", () => {
  it("con los valores por defecto el reparto es el de siempre (fórmula previa)", () => {
    const wall = openingWall(spec());
    const ky = 1;
    wall.forEach((c, i) => {
      const col = i % 6, row = Math.floor(i / 6);
      expect(c.x).toBe(Math.round((col - 2.5) * (2400 / 6) + (row % 2) * 200 - 100 + (random(`x${i}`) - 0.5) * 40));
      expect(c.y).toBe(Math.round((-420 + row * (840 / 5)) * ky + (random(`y${i}`) - 0.5) * 24));
    });
    expect(wall.length).toBe(36);
  });
  it("formato alto: también el de siempre", () => {
    const h = 1920, w = 1080;
    openingWall(spec(), h, w).forEach((c, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      expect(c.x).toBe(Math.round((col - 1) * (1230 / 3) + (row % 2 ? 100 : -100) + (random(`x${i}`) - 0.5) * 30));
      expect(c.y).toBe(Math.round((row - 5.5) * ((h / 12.2) * (12 / 12)) + (random(`y${i}`) - 0.5) * 20));
    });
  });
  it("brick 0 alinea las columnas (grilla ajustada) y jitter 0 saca el temblor", () => {
    const grilla = openingWall(spec({ wall: { brick: 0, jitter: 0 } }));
    const xs = (row: number) => grilla.slice(row * 6, row * 6 + 6).map((c) => c.x);
    expect(xs(0)).toEqual(xs(1));
    expect(xs(0)).toEqual(xs(2));
    const ys0 = grilla.slice(0, 6).map((c) => c.y);
    expect(new Set(ys0).size).toBe(1);
    const suelto = openingWall(spec({ wall: { brick: 2, jitter: 3 } }));
    expect(xs(0)).not.toEqual(suelto.slice(0, 6).map((c) => c.x));
  });
  it("gapX y gapY escalan la grilla desde el centro", () => {
    const a = openingWall(spec({ wall: { brick: 0, jitter: 0 } }));
    const b = openingWall(spec({ wall: { brick: 0, jitter: 0, gapX: 2, gapY: 0.5 } }));
    expect(b[5]!.x).toBeCloseTo(a[5]!.x * 2, -1);
    expect(b[30]!.y).toBeCloseTo(a[30]!.y * 0.5, -1);
  });
  it("es determinista", () => {
    const d = { wall: { jitter: 2.5, brick: 1.5, gapX: 1.3 } };
    expect(openingWall(spec(d))).toEqual(openingWall(spec(d)));
  });
  it("el design system lo declara y el video lo pisa", () => {
    const e = resolveStoryDesign(editorial, undefined, 1920, 1080);
    expect(e.wall).toMatchObject({ brick: 0, jitter: 0, gapX: 0.85, gapY: 0.9 });
    const v = resolveStoryDesign(editorial, { wall: { brick: 1 } }, 1920, 1080);
    expect(v.wall).toMatchObject({ brick: 1, jitter: 0 });
    // una apertura con el tema editorial y su grilla ajustada usa su propio reparto
    const grilla = openingWall({ ...spec(), design: e }, 1080, 1920);
    expect(new Set(grilla.slice(0, 5).map((c) => c.y)).size).toBe(1);
  });
  it("valida los rangos", () => {
    expect(() => validateSpec(spec({ wall: { gapX: 5 } }))).toThrow(/wall.gapX/);
    expect(() => validateSpec(spec({ wall: { gapY: 0.1 } }))).toThrow(/wall.gapY/);
    expect(() => validateSpec(spec({ wall: { brick: -1 } }))).toThrow(/wall.brick/);
    expect(() => validateSpec(spec({ wall: { jitter: 9 } }))).toThrow(/wall.jitter/);
    expect(() => validateSpec(spec({ wall: { brick: 0, jitter: 0, gapX: 1.2, gapY: 1.2 } }))).not.toThrow();
  });
});

describe("escalonado de la apertura", () => {
  const t = (css: string) => themeFromTokens(css);
  // el cuadro en que aparece la segunda fila de la lista: con un paso mayor, más tarde
  it("staggerList retrasa las filas de la lista y staggerChips las piezas del muro", () => {
    const lento = t("--style-motion-stagger-list: 40;");
    const f = 104 + 60;
    const base = html(<Opening spec={spec()} />, f, neutral);
    const tarde = html(<Opening spec={spec()} />, f, lento);
    expect(tarde).not.toBe(base);
    expect(html(<Opening spec={spec()} />, 20, t("--style-motion-stagger-chips: 3;"))).not.toBe(html(<Opening spec={spec()} />, 20, neutral));
  });
  it("sin pasos de contexto, nada cambia respecto del tema por defecto", () => {
    expect(html(<Opening spec={spec()} />, 130, themeFromTokens({}, neutral, { style: { motion: { staggerList: null, staggerChips: null } } }))).toBe(html(<Opening spec={spec()} />, 130, neutral));
  });
  it("la entrada en profundidad de neón aplica perspective() por fila, sin preserve-3d", () => {
    const h = html(<Opening spec={spec()} />, 112, neon);
    expect(h).toContain("perspective(1400px)");
    expect(h).not.toContain("preserve-3d");
    const e = html(<Opening spec={spec()} />, 112, editorial);
    expect(e).not.toContain("preserve-3d");
  });
});

describe("línea de apoyo de la lista: caption", () => {
  it("con el estilo por defecto la línea no lleva caja ni interletrado; con captionCase upper sí", () => {
    const h = html(<Opening spec={spec()} />, 200, neutral);
    expect(h).not.toContain("text-transform");
    const up = themeFromTokens({}, neutral, { style: { type: { captionCase: "upper", captionTracking: 0.1 } } });
    expect(html(<Opening spec={spec()} />, 200, up)).toContain("text-transform:uppercase");
  });
});
