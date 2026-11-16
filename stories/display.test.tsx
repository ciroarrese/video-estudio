import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral } from "../themes";
import type { Theme } from "../themes";
import { Closing, Interlude, InterludeCompact, Opening } from "./index";
import type { StorySpec } from "./index";
import { HeadlineRow, Pill } from "./shared";
import { listLayout, nameMeter } from "./layout";

// Los títulos de la historia (apertura, lista, píldoras, vueltas, cierre) usan la familia de títulos del tema (`font.display`), nunca `font.family` directo.
const SERIF = '"Titulos Prueba", serif';
const withDisplay: Theme = { ...neutral, font: { ...neutral.font, display: SERIF } };
const SPEC: StorySpec = {
  title: { text: "Un título de prueba", highlight: "prueba" },
  topics: [{ id: "a", name: "Primer tema", line: "una línea del primero" }, { id: "b", name: "Segundo", line: "otra línea" }],
  labels: ["Uno", "Dos"],
  signoff: { text: "Gracias", tagline: "Una nota" },
};
const config = { fps: 30, width: 1080, height: 1920, durationInFrames: 900 };
const html = (el: React.ReactElement, frame: number, theme: Theme) => renderToStaticMarkup(<FrameProvider frame={frame} config={config}><ThemeProvider theme={theme}>{el}</ThemeProvider></FrameProvider>);
const familias = (h: string) => [...h.replace(/&quot;/g, "'").matchAll(/font-family:([^;"]+)/g)].map((m) => m[1]!.trim().replace(/'/g, '"'));

describe("font.display en los títulos de la historia", () => {
  const L = listLayout(SPEC, withDisplay, 1080, 1920);
  const piezas: [string, React.ReactElement, number][] = [
    ["Opening", <Opening key="o" spec={SPEC} />, 60],
    ["HeadlineRow", <HeadlineRow key="h" i={0} L={L} />, 0],
    ["Pill", <Pill key="p" index={0} name="Primer tema" />, 0],
    ["Interlude", <Interlude key="i" spec={SPEC} done={1} />, 40],
    ["InterludeCompact", <InterludeCompact key="c" spec={SPEC} done={1} />, 20],
    ["Closing", <Closing key="k" spec={SPEC} />, 400],
  ];
  for (const [nombre, el, frame] of piezas) {
    it(`${nombre}: el título lleva la familia de títulos del tema, y sin font.display no declara familia propia`, () => {
      expect(familias(html(el, frame, withDisplay)).some((f) => f === SERIF), nombre).toBe(true);
      expect(familias(html(el, frame, neutral)).filter((f) => f === SERIF)).toEqual([]);
    });
  }
  it("el medidor del nombre lleva la holgura pedida", () => {
    expect(nameMeter(withDisplay).factor).toBeCloseTo(1.03);
    expect(nameMeter(withDisplay, 1.4)("Recordatorio", 100)).toBeCloseTo(nameMeter(withDisplay, 1)("Recordatorio", 100) * 1.4);
  });
});
