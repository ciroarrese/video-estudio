import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral } from "../themes";
import * as fx from "./index";

/**
 * Regla de `docs/reglas.md` ("Texto de un SVG bajo escala"): el texto de un `<svg>` que queda bajo un `scale()` de un ancestro (una miniatura,
 * una escena anidada, una cámara con zoom) se rasteriza con la escala que Chromium calculó en el último diseño, y esa escala depende del historial
 * de cuadros: el mismo cuadro sale distinto según qué se dibujó antes. Con `text-rendering: geometricPrecision` no hay escala calculada y el
 * resultado es estable. Por eso todo efecto del catálogo con `<text>` o `<textPath>` lo lleva puesto (en el `<svg>` raíz o en un `<g>` que
 * envuelve el texto).
 */
const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 2000 };

const html = (node: React.ReactNode, frame: number) =>
  renderToString(<FrameProvider frame={frame} config={config}><ThemeProvider theme={neutral}>{node}</ThemeProvider></FrameProvider>);

const casos: [string, (f: number) => React.ReactNode][] = [
  ["LineDraw", (f) => <fx.LineDraw frame={f} start={0} />],
  ["DonutRing", (f) => <fx.DonutRing frame={f} start={0} />],
  ["RadarMorph", (f) => <fx.RadarMorph frame={f} start={0} />],
  ["Bars3D", (f) => <fx.Bars3D frame={f} start={0} />],
  ["BarsGrow", (f) => <fx.BarsGrow frame={f} start={0} />],
  ["FlowSteps", (f) => <fx.FlowSteps frame={f} start={0} />],
  ["TileDone", (f) => <fx.TileDone frame={f} start={0} duration={30} />],
  ["BlueprintDraw", (f) => <fx.BlueprintDraw frame={f} start={0} />],
  ["MarkerDraw", (f) => <fx.MarkerDraw frame={f} start={0} kind="circle" />],
  ["PaperCollage", (f) => <fx.PaperCollage frame={f} start={0} />],
  ["SealSpin", (f) => <fx.SealSpin frame={f} start={0} />],
];

const geometrico = (el: Element) => {
  for (let e: Element | null = el; e; e = e.parentElement) {
    if (e.getAttribute("text-rendering") === "geometricPrecision" || /text-rendering:\s*geometricPrecision/.test(e.getAttribute("style") ?? "")) return true;
  }
  return false;
};

describe("catálogo fx: el texto SVG va con text-rendering geometricPrecision", () => {
  for (const [name, mk] of casos) {
    it(name, () => {
      const doc = new DOMParser().parseFromString(`<body>${html(mk(120), 120)}</body>`, "text/html");
      const textos = Array.from(doc.body.querySelectorAll("text, textPath"));
      expect(textos.length, `${name} no dibujó texto SVG: el caso ya no prueba nada`).toBeGreaterThan(0);
      for (const t of textos) expect(geometrico(t), `${name}: <${t.tagName}> "${(t.textContent ?? "").slice(0, 20)}" sin geometricPrecision`).toBe(true);
    });
  }
});
