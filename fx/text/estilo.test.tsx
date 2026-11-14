import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../../engine";
import { ThemeProvider, dark, editorial, neon, neutral, papel } from "../../themes";
import {
  CardFlip, CarouselRing, CubeFold, CubeStack, DigitRoll, ExtrudeType, Globe, Helix, IsoCity, KineticWords, LayerExplode, MarqueeBands, MaskedRise, OrbitRings,
  ParticleSphere, PhoneOrbit, ScrambleDecode, SplitFlap, TerrainMesh, TorusWire, Tunnel, TypeRing, Typewriter, WaveDots,
} from "../index";

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
  ["KineticWords", <KineticWords words={["Uno", "dos"]} />],
  ["DigitRoll", <DigitRoll value={4820} suffix="+" />],
  ["MarqueeBands", <MarqueeBands lines={["Uno", "Dos"]} />],
  ["TypeRing", <TypeRing text="Anillo" />],
  ["Globe", <Globe />], ["ParticleSphere", <ParticleSphere />], ["CubeStack", <CubeStack />], ["CubeFold", <CubeFold />], ["Tunnel", <Tunnel />],
  ["TerrainMesh", <TerrainMesh />], ["TorusWire", <TorusWire />], ["Helix", <Helix />], ["OrbitRings", <OrbitRings />], ["WaveDots", <WaveDots />],
  ["IsoCity", <IsoCity />], ["ExtrudeType", <ExtrudeType />], ["PhoneOrbit", <PhoneOrbit />],
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

  it("llegada, cursor, adorno y losetas: en reposo no queda ninguna identidad y cada tema los cambia", () => {
    const rest = (el: React.ReactElement, t: typeof neutral) => html(el, t, 399);
    // Typewriter con extra: el cursor y el adorno del tema.
    expect(rest(<Typewriter text="Hola" after={<b>ok</b>} />, editorial)).toMatch(/height:0\.09em/); // guion bajo
    expect(rest(<Typewriter text="Hola" />, neon)).toMatch(/width:0\.52em;height:1em/); // bloque
    expect(rest(<Typewriter text="Hola" />, neutral)).toContain("width:0.09em;height:1em");
    for (const t of [editorial, neon, papel]) {
      // el adorno del tema (subrayado, marcador o recuadro) es un `span` sin texto marcado `covered`: no cuenta como tapa de su anfitrión
      expect(rest(<MaskedRise text="Hola mundo" />, t)).toContain('aria-hidden="true" data-qa-ignore="covered"');
      expect(rest(<ScrambleDecode text="Hola" />, t)).toContain('aria-hidden="true" data-qa-ignore="covered"');
      expect(rest(<DigitRoll value={48} />, t)).toContain('aria-hidden="true" data-qa-ignore="covered"');
    }
    for (const t of [neutral, dark]) expect(rest(<MaskedRise text="Hola mundo" />, t)).not.toContain('data-qa-ignore="covered"');
    // Losetas de SplitFlap: sin bisagra con `outline` y `flat`; con `card`, la de siempre.
    expect(rest(<SplitFlap text="AB" />, neutral)).toContain("height:2px");
    expect(rest(<SplitFlap text="AB" />, editorial)).not.toContain("height:2px");
    expect(rest(<SplitFlap text="AB" />, papel)).not.toContain("height:2px");
    // Separador de las bandas según la forma de punto.
    expect(rest(<MarqueeBands lines={["Uno"]} />, neutral)).toContain("•");
    expect(rest(<MarqueeBands lines={["Uno"]} />, editorial)).toContain("\u25AA");
    expect(rest(<MarqueeBands lines={["Uno"]} />, papel)).toContain("+");
  });
});
