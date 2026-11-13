import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../../engine";
import { ThemeProvider, dark, editorial, neon, neutral, papel } from "../../themes";
import { CardFlip, CarouselRing, LayerExplode, MaskedRise, ScrambleDecode, SplitFlap, Typewriter } from "../index";

// El estilo del design system en los efectos de texto y 3D: por defecto sin cambios, y en reposo sin residuos con los cinco temas.
const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 400 };
const html = (el: React.ReactElement, theme: typeof neutral, frame: number) =>
  renderToString(<FrameProvider frame={frame} config={config}><ThemeProvider theme={theme}>{el}</ThemeProvider></FrameProvider>);

const EFECTOS: [string, React.ReactElement][] = [
  ["MaskedRise", <MaskedRise text="Hola mundo" dot />],
  ["Typewriter", <Typewriter text="Hola" />],
  ["ScrambleDecode", <ScrambleDecode text="Hola" />],
  ["SplitFlap", <SplitFlap text="LISTO" />],
  ["CardFlip", <CardFlip />],
  ["CarouselRing", <CarouselRing />],
  ["LayerExplode", <LayerExplode />],
];

describe("estilo en fx/text y fx/three", () => {
  for (const [nombre, el] of EFECTOS) {
    it(`${nombre}: sin residuos en reposo con los cinco temas`, () => {
      for (const t of [neutral, dark, editorial, neon, papel]) {
        const h = html(el, t, 399);
        expect(h).not.toMatch(/translateY\(0px\)|scale\(1\)|opacity:0\.99/);
      }
    });
  }
  it("con el estilo por defecto el titular conserva semibold y sin interletrado", () => {
    const h = html(<Typewriter text="Hola" />, neutral, 399);
    expect(h).toContain(`font-weight:${neutral.font.weights.semibold}`);
    expect(h).not.toContain("letter-spacing");
  });
  it("editorial cambia peso e interletrado; las tarjetas pierden el redondeo", () => {
    const h = html(<Typewriter text="Hola" />, editorial, 399);
    expect(h).toContain(`font-weight:${editorial.font.weights.medium}`);
    expect(h).toContain("letter-spacing:-0.01em");
    expect(html(<CardFlip />, editorial, 399)).toContain("border-radius:0");
  });
});
