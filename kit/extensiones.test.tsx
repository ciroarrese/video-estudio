import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral, themeFromTokens } from "../themes";
import type { Theme } from "../themes";
import { CloudBackground, DockedHeadline, GradientText, Stage, Vignette, flyInZ } from "./index";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 300 };
const html = (node: React.ReactNode, frame = 0, theme: Theme = neutral) =>
  renderToString(<FrameProvider frame={frame} config={config}><ThemeProvider theme={theme}>{node}</ThemeProvider></FrameProvider>);

describe("flyInZ", () => {
  it("devuelve perspective() propio, sin preserve-3d, y no deja residuos al llegar", () => {
    const s = flyInZ(0.5, { from: 800, perspective: 1200, x: 100 });
    expect(s.transform).toBe("perspective(1200px) translate3d(50px, 0px, -400px)");
    expect(s.opacity).toBe(0.5);
    expect(JSON.stringify(s)).not.toMatch(/preserve-3d/);
    expect(flyInZ(1)).toEqual({});
    expect(flyInZ(3)).toEqual({});
    expect(flyInZ(0).opacity).toBe(0);
    expect(flyInZ(0.5, { fade: false }).opacity).toBeUndefined();
  });
  it("valida la perspectiva", () => {
    expect(() => flyInZ(0.5, { from: 2000, perspective: 1400 })).toThrow(/menor que perspective/);
    expect(() => flyInZ(0.5, { perspective: 0 })).toThrow(/perspective/);
  });
  it("es pura: mismo progreso, mismo estilo", () => {
    expect(flyInZ(0.37, { rotateY: 20 })).toEqual(flyInZ(0.37, { rotateY: 20 }));
  });
});

describe("Vignette", () => {
  it("por defecto usa el acento; color y strength lo cambian", () => {
    const def = html(<Vignette amount={1} />);
    expect(def).toContain("rgba(59, 91, 219, 0.22)");
    expect(html(<Vignette amount={1} color="bg" strength={2} />)).toContain("rgba(246, 247, 251, 0.44)");
    expect(html(<Vignette amount={1} color="#102030" strength={10} />)).toContain("rgba(16, 32, 48, 1)");
    expect(html(<Vignette amount={1} strength={0} />)).toBe("");
    expect(() => html(<Vignette amount={1} color="inexistente" />)).toThrow(/inexistente/);
  });
});

describe("DockedHeadline layout", () => {
  it("stacked es el valor por defecto; inline pone todo en una línea", () => {
    const st = html(<DockedHeadline index={4} title="Nombre" subtitle="línea" start={0} />, 30);
    const il = html(<DockedHeadline index={4} title="Nombre" subtitle="línea" start={0} layout="inline" />, 30);
    expect(st).toContain("flex-direction:column");
    expect(il).not.toContain("flex-direction:column");
    expect(il).toContain("·");
    expect(il).toContain("04");
    expect(html(<DockedHeadline index={4} title="Nombre" start={0} layout="inline" />, 30)).not.toContain("·");
  });
});

describe("GradientText loop", () => {
  it("el vaivén vuelve exacto al terminar el ciclo y solo depende del cuadro", () => {
    const at = (f: number) => html(<GradientText loop={60}>x</GradientText>, f);
    expect(at(0)).toBe(at(60));
    expect(at(15)).not.toBe(at(0));
    expect(at(15)).toContain("background-position:100% 0");
    expect(at(15)).toBe(at(15));
    expect(html(<GradientText>x</GradientText>, 15)).toContain("background-position:0% 0");
  });
});

describe("nubes elegidas por la escena", () => {
  const blobs = [{ x: 0.2, y: 0.3, size: 600, color: "accent2" }, { x: 0.8, y: 0.7 }];
  it("blobs explícitos, colores y cantidad", () => {
    const h = html(<CloudBackground blobs={blobs} colors={["accent"]} />);
    expect(h.match(/filter:blur/g)).toHaveLength(2);
    expect(h).toContain("width:600px");
    expect(h).toContain("width:700px");
    expect(h).toContain(neutral.color.accent2);
    expect(html(<CloudBackground count={3} />).match(/filter:blur/g)).toHaveLength(3);
    expect(html(<CloudBackground />).match(/filter:blur/g)).toHaveLength(6);
  });
  it("toma lo que declara el tema y Stage deja pisarlo", () => {
    const t = themeFromTokens("--cloud-count: 2; --cloud-color-1: #112233; --cloud-opacity: 0.5;");
    expect(html(<CloudBackground />, 0, t).match(/filter:blur/g)).toHaveLength(2);
    expect(html(<CloudBackground />, 0, t)).toContain("background:#112233");
    expect(html(<Stage cloud={{ count: 5, colors: ["success"], opacity: 0.1 }} />, 0, t).match(/filter:blur/g)).toHaveLength(5);
    expect(html(<Stage cloud={{ opacity: 0.1 }} />, 0, t)).toContain("opacity:0.1");
    expect(html(<Stage cloud={{ blobs }} cloudOpacity={0.3} />, 0, t)).toContain("opacity:0.3");
  });
  it("es determinista", () => {
    expect(html(<CloudBackground blobs={blobs} />, 40)).toBe(html(<CloudBackground blobs={blobs} />, 40));
  });
});
