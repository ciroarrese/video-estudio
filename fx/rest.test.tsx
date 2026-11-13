import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral } from "../themes";
import * as fx from "./index";

/**
 * Regresión de los efectos "en uso": dentro de una escena un efecto vive montado antes de `start` y después de
 * terminar. Dos cosas tienen que cumplirse en TODOS los efectos:
 *  1. Historial: el marcado de un cuadro es el mismo se haya llegado desde donde se haya llegado (React agrega las
 *     propiedades de estilo y los atributos que reaparecen al final, y `checkDeterminism` compara el HTML textual).
 *  2. En reposo (antes de `start` y después del final) no queda ninguna transformación identidad ni opacidad casi 1.
 */

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 400 };
const START = 40;

const R = React.createElement;
type Make = (p: Record<string, unknown>) => React.ReactElement;
const E = (C: React.ComponentType<any>, extra: Record<string, unknown> = {}): Make => (p) => R(C, { ...extra, ...p });

const EFFECTS: Record<string, Make> = {
  MaskedRise: E(fx.MaskedRise, { text: "Hola mundo", dot: true }),
  MaskedRiseWords: E(fx.MaskedRise, { text: "Hola mundo", by: "word" }),
  KineticWords: E(fx.KineticWords, { words: ["Uno", "dos", "tres"] }),
  Typewriter: E(fx.Typewriter, { text: "Escribiendo", after: R("span", null, "listo") }),
  ScrambleDecode: E(fx.ScrambleDecode, { text: "Hola mundo" }),
  SplitFlap: E(fx.SplitFlap, { text: "LISTO" }),
  DigitRoll: E(fx.DigitRoll, { value: 1284, suffix: "%" }),
  DigitRollPlain: E(fx.DigitRoll, { value: 48 }),
  MarqueeBands: E(fx.MarqueeBands, { lines: ["A", "B"] }),
  TypeRing: E(fx.TypeRing, { text: "Hola" }),
  Globe: E(fx.Globe), ParticleSphere: E(fx.ParticleSphere), CubeStack: E(fx.CubeStack), CubeFold: E(fx.CubeFold),
  Tunnel: E(fx.Tunnel), TerrainMesh: E(fx.TerrainMesh), TorusWire: E(fx.TorusWire), Helix: E(fx.Helix),
  OrbitRings: E(fx.OrbitRings), WaveDots: E(fx.WaveDots), LayerExplode: E(fx.LayerExplode), CardFlip: E(fx.CardFlip),
  CarouselRing: E(fx.CarouselRing), IsoCity: E(fx.IsoCity), ExtrudeType: E(fx.ExtrudeType, { text: "Hola" }), PhoneOrbit: E(fx.PhoneOrbit),
  LineDraw: E(fx.LineDraw), DonutRing: E(fx.DonutRing), DonutRingFull: E(fx.DonutRing, { value: 4, max: 4 }), RadarMorph: E(fx.RadarMorph),
  Bars3D: E(fx.Bars3D), BarsGrow: E(fx.BarsGrow), FlowSteps: E(fx.FlowSteps),
  NotificationStack: E(fx.NotificationStack), ChatThread: E(fx.ChatThread), CommandPalette: E(fx.CommandPalette),
  CardFan: E(fx.CardFan), PhoneFrame: E(fx.PhoneFrame, { children: R("div", null, "x") }), PhoneScroll: E(fx.PhoneScroll, { children: R("div", { style: { height: 1400 } }, "x") }),
  BeforeAfter: E(fx.BeforeAfter), TileGrid: E(fx.TileGrid), TileDone: E(fx.TileDone),
  BlueprintDraw: E(fx.BlueprintDraw), MarkerDraw: E(fx.MarkerDraw), PaperCollage: E(fx.PaperCollage), ShapeMorph: E(fx.ShapeMorph),
  DotWipe: E(fx.DotWipe), HalftoneWave: E(fx.HalftoneWave), PixelBuild: E(fx.PixelBuild), LogoLand: E(fx.LogoLand),
  LiquidBlob: E(fx.LiquidBlob), SealSpin: E(fx.SealSpin), RibbonTwist: E(fx.RibbonTwist),
};

const tree = (el: React.ReactElement, frame: number) => (
  <FrameProvider frame={frame} config={config}>
    <ThemeProvider theme={neutral}>{el}</ThemeProvider>
  </FrameProvider>
);

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});
beforeEach(() => {
  const ctx = new Proxy({} as Record<string, unknown>, { get: () => () => ({ addColorStop() {} }), set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctx) as never);
});
afterEach(() => vi.restoreAllMocks());

/** Marcado del cuadro `f` en una raíz que ya pasó por los cuadros de `before`. */
function htmlAfter(el: React.ReactElement, before: number[], f: number): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  for (const n of [...before, f]) flushSync(() => root.render(tree(el, n)));
  const out = host.innerHTML;
  root.unmount();
  return out;
}

const FRAMES = [0, 20, 39, 40, 41, 55, 70, 90, 110, 130, 160, 200, 260, 399];

describe("efectos en uso: reposo e historial", () => {
  for (const [name, make] of Object.entries(EFFECTS)) {
    it(`${name}: el marcado de cada cuadro no depende del historial`, () => {
      const el = make({ start: START });
      for (const f of FRAMES) {
        const fresh = htmlAfter(el, [], f);
        // se llega desde el último cuadro, desde el primero y desde uno intermedio
        for (const before of [[399], [0, 399], [130, 399, 0], [f === 0 ? 1 : 0]]) {
          expect(htmlAfter(el, before, f), `${name} cuadro ${f} tras ${before}`).toBe(fresh);
        }
      }
    });
    it(`${name}: en reposo (antes de start y después del final) no deja transformaciones identidad`, () => {
      const el = make({ start: START });
      for (const f of [0, 39, 399]) {
        const markup = renderToString(tree(el, f));
        const leftovers = [
          ...(markup.match(/translate(?:X|Y|3d)?\(\s*-?0(?:\.0+)?(?:px|%)?\s*(?:,\s*-?0(?:\.0+)?(?:px|%)?\s*)*\)/g) ?? []),
          ...(markup.match(/scale(?:X|Y)?\(\s*1(?:\.0+)?\s*(?:,\s*1(?:\.0+)?\s*)?\)/g) ?? []),
          ...(markup.match(/rotate[XYZ]?\(\s*-?0(?:\.0+)?(?:deg)?\s*\)/g) ?? []),
          ...(markup.match(/blur\(\s*0(?:\.0+)?(?:px)?\s*\)/g) ?? []),
          ...(markup.match(/opacity:\s*0\.9\d+/g) ?? []),
          ...(markup.match(/opacity="0\.9\d+"/g) ?? []),
        ];
        expect(leftovers, `${name} cuadro ${f}`).toEqual([]);
      }
    });
  }
});
