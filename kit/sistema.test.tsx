import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, editorial, entrance, neon, neutral, themeFromTokens } from "../themes";
import type { Theme } from "../themes";
import { CloudBackground, DockedHeadline, Stage, Vignette, flyInZ } from "./index";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 300 };
const html = (node: React.ReactNode, frame = 0, theme: Theme = neutral) =>
  renderToString(<FrameProvider frame={frame} config={config}><ThemeProvider theme={theme}>{node}</ThemeProvider></FrameProvider>);

describe("nubes: el desenfoque sale del tema y una escena lo pisa", () => {
  it("sin declarar es el 110 de siempre", () => {
    expect(html(<CloudBackground />)).toContain("filter:blur(110px)");
    expect(html(<Stage />)).toContain("filter:blur(110px)");
  });
  it("cloud.blur del tema lo cambia en CloudBackground y en Stage; `blur` de la escena gana", () => {
    const t = themeFromTokens("--cloud-blur: 64;");
    expect(html(<CloudBackground />, 0, t)).toContain("filter:blur(64px)");
    expect(html(<CloudBackground />, 0, t)).not.toContain("blur(110px)");
    expect(html(<Stage />, 0, t)).toContain("filter:blur(64px)");
    expect(html(<Stage cloud={{ blur: 20 }} />, 0, t)).toContain("filter:blur(20px)");
    expect(html(<CloudBackground blur={30} />, 0, t)).toContain("filter:blur(30px)");
    expect(html(<CloudBackground />, 0, neon)).toContain("filter:blur(140px)");
  });
});

describe("viñeta: el color lo decide el design system", () => {
  it("por defecto el acento; neón la tiñe con accent2; la escena puede pasar el suyo", () => {
    expect(html(<Vignette amount={1} />)).toContain("rgba(59, 91, 219");
    expect(html(<Vignette amount={1} />, 0, neon)).toContain("rgba(255, 95, 210");
    expect(html(<Vignette amount={1} color="bg" />, 0, neon)).toContain("rgba(9, 11, 22");
  });
});

describe("subtítulo del titular: rol caption", () => {
  const sub = (t: Theme) => html(<DockedHeadline index={1} title="Tema" subtitle="línea de apoyo" layout="inline" />, 40, t);
  it("neutral y neón (sin caption propio) siguen al eyebrow, como siempre", () => {
    expect(sub(neutral)).not.toContain("text-transform");
    expect(sub(neon)).toContain("text-transform:uppercase");
  });
  it("editorial pone los eyebrows en mayúsculas pero el subtítulo en caja normal", () => {
    expect(sub(editorial)).not.toContain("text-transform");
    const todo = themeFromTokens({}, editorial, { style: { type: { captionCase: "upper" } } });
    expect(sub(todo)).toContain("text-transform:uppercase");
  });
});

describe("entrada en profundidad del design system = flyInZ", () => {
  it("con 900 px de profundidad el transform es el mismo que da `flyInZ` por defecto", () => {
    const depth = themeFromTokens({}, neutral, { style: { motion: { entrance: "depth" } } });
    for (const p of [0.1, 0.5, 0.9]) expect(entrance(depth, p, 0, { depth: 900, round: false }).transform).toBe(flyInZ(p).transform);
  });
});
