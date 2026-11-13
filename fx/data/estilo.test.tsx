import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FrameProvider } from "../../engine";
import { ThemeProvider, dark, editorial, neon, neutral, papel } from "../../themes";
import * as fx from "../index";

/**
 * Los efectos de datos, interfaz y arte con los cinco temas (dos neutros y los tres design systems de ejemplo): el marcado de cada cuadro
 * no depende del historial y en reposo no queda ninguna transformación identidad ni opacidad casi 1.
 */
const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 400 };
const START = 40;
const R = React.createElement;
type Make = (p: Record<string, unknown>) => React.ReactElement;
const E = (C: React.ComponentType<any>, extra: Record<string, unknown> = {}): Make => (p) => R(C, { ...extra, ...p });

const EFFECTS: Record<string, Make> = {
  LineDraw: E(fx.LineDraw), DonutRing: E(fx.DonutRing), RadarMorph: E(fx.RadarMorph), Bars3D: E(fx.Bars3D), BarsGrow: E(fx.BarsGrow), FlowSteps: E(fx.FlowSteps),
  NotificationStack: E(fx.NotificationStack), ChatThread: E(fx.ChatThread), CommandPalette: E(fx.CommandPalette), CardFan: E(fx.CardFan),
  PhoneFrame: E(fx.PhoneFrame, { children: R("div", null, "x") }), PhoneScroll: E(fx.PhoneScroll, { children: R("div", { style: { height: 1400 } }, "x") }),
  BeforeAfter: E(fx.BeforeAfter), TileGrid: E(fx.TileGrid), TileDone: E(fx.TileDone),
  BlueprintDraw: E(fx.BlueprintDraw), MarkerDraw: E(fx.MarkerDraw), PaperCollage: E(fx.PaperCollage), LogoLand: E(fx.LogoLand),
};
const THEMES = { neutral, dark, editorial, neon, papel };

const tree = (el: React.ReactElement, frame: number, theme: typeof neutral) => (
  <FrameProvider frame={frame} config={config}>
    <ThemeProvider theme={theme}>{el}</ThemeProvider>
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

function htmlAfter(el: React.ReactElement, theme: typeof neutral, before: number[], f: number): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  for (const n of [...before, f]) flushSync(() => root.render(tree(el, n, theme)));
  const out = host.innerHTML;
  root.unmount();
  return out;
}

const FRAMES = [0, 41, 55, 70, 90, 130, 399];

for (const [tn, theme] of Object.entries(THEMES)) {
  describe(`efectos de data, ui y art con el tema ${tn}`, () => {
    for (const [name, make] of Object.entries(EFFECTS)) {
      it(`${name}: el marcado no depende del historial`, () => {
        const el = make({ start: START });
        for (const f of FRAMES) {
          const fresh = htmlAfter(el, theme, [], f);
          for (const before of [[399], [0, 399], [f === 0 ? 1 : 0]]) expect(htmlAfter(el, theme, before, f), `${name} cuadro ${f} tras ${before}`).toBe(fresh);
        }
      });
      it(`${name}: en reposo no deja identidades`, () => {
        const el = make({ start: START });
        for (const f of [0, 39, 399]) {
          const markup = renderToString(tree(el, f, theme));
          const leftovers = [
            ...(markup.match(/translate(?:X|Y|3d)?\(\s*-?0(?:\.0+)?(?:px|%)?\s*(?:,\s*-?0(?:\.0+)?(?:px|%)?\s*)*\)/g) ?? []),
            ...(markup.match(/scale(?:X|Y)?\(\s*1(?:\.0+)?\s*(?:,\s*1(?:\.0+)?\s*)?\)/g) ?? []),
            ...(markup.match(/rotate[XYZ]?\(\s*-?0(?:\.0+)?(?:deg)?\s*\)/g) ?? []),
            ...(markup.match(/opacity:\s*0\.9\d+/g) ?? []),
          ];
          expect(leftovers.slice(0, 6), `${name} cuadro ${f}`).toEqual([]);
        }
      });
    }
  });
}

describe("estilo en los gráficos", () => {
  it("el relleno rayado deriva sus ids de las props (sin useId)", () => {
    const a = renderToString(tree(R(fx.BarsGrow, { frame: 60, seed: "a" }), 60, editorial));
    const b = renderToString(tree(R(fx.BarsGrow, { frame: 60, seed: "a" }), 60, editorial));
    expect(a).toBe(b);
    expect(a).toContain("<pattern");
    expect(renderToString(tree(R(fx.BarsGrow, { frame: 60 }), 60, neutral))).not.toContain("<pattern");
  });
});
