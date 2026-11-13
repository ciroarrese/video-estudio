import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral } from "../themes";
import { Closing, Interlude, InterludeCompact, Opening, closingFrames, interludeCompactFrames, interludeFrames, openingFrames } from "./index";
import type { StorySpec } from "./index";
import { CheckMark, Chip, HeadlineRow, Pill } from "./shared";
import { listLayout } from "./layout";

/**
 * Regresión de las piezas de `stories/` (apertura, vueltas, cierre y piezas compartidas), igual que `fx/rest.test.tsx`:
 *  1. Historial: el marcado de un cuadro es el mismo se haya llegado desde donde se haya llegado.
 *  2. Reposo: ninguna transformación identidad (`translateY(0px)`, `scale(1)`...), `blur(0)` ni opacidad casi 1. Las capas con `perspective()`
 *     (el muro y los paneles 3D) se salen de la regla: ahí `transform` siempre lleva la cuenta entera de la cámara.
 * Un `translateY(0px) scale(1.0000)` residual en el cartel de la apertura rompía `--check` con casi cualquier título.
 */

const SPEC: StorySpec = {
  title: { text: "Un título cualquiera para probar el reposo", highlight: "reposo" },
  topics: [
    { id: "a", name: "Primer tema de la lista", line: "una línea descriptiva del primero" },
    { id: "b", name: "Segundo", line: "otra línea" },
    { id: "c", name: "Tercer tema algo más largo", line: "la tercera línea de la lista" },
  ],
  labels: ["Uno", "Dos", "Tres", "Cuatro"],
  signoff: { text: "Gracias por **mirar**", tagline: "Una nota al pie" },
};
const SPECS: Record<string, StorySpec> = {
  base: SPEC,
  vidrio: { ...SPEC, design: { titleCard: "glass", wall: { columns: 4, rows: 5, blur: false } } },
  renglon: { ...SPEC, design: { list: "inline" } },
  acople: { ...SPEC, design: { handoff: "dock" } },
  paso: { ...SPEC, design: { handoff: "through", list: { layout: "inline", underline: "name" } } },
  bucle: { ...SPEC, design: { gradient: { loop: 45 }, headline: { size: "sm" }, handoff: "dock", list: "inline" } },
  muro: { ...SPEC, design: { wall: { chipScale: 1.4, dolly: 500, depth: 1.6, blur: { opening: false, closing: true } }, closing: { bg: "surface" } } },
  titulo2: { ...SPEC, title: { text: "Hola" }, signoff: { text: "Chau" } },
  largo: { ...SPEC, title: { text: "Un título larguísimo que obliga a achicar la letra y a partirlo en renglones, a ver qué pasa" } },
};

const R = React.createElement;
const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 600 };
const tree = (el: React.ReactElement, frame: number, cfg = config) => (
  <FrameProvider frame={frame} config={cfg}>
    <ThemeProvider theme={neutral}>{el}</ThemeProvider>
  </FrameProvider>
);

type Piece = { make: () => React.ReactElement; frames: number };
const PIECES: Record<string, Piece> = {};
for (const [k, spec] of Object.entries(SPECS)) {
  PIECES[`Opening/${k}`] = { make: () => R(Opening, { spec }), frames: openingFrames(spec) };
  PIECES[`Closing/${k}`] = { make: () => R(Closing, { spec }), frames: closingFrames(spec) };
}
PIECES["Interlude/1"] = { make: () => R(Interlude, { spec: SPEC, done: 1 }), frames: interludeFrames(SPEC) };
PIECES["Interlude/3 (ultima)"] = { make: () => R(Interlude, { spec: SPEC, done: 3 }), frames: interludeFrames(SPEC) };
PIECES["Interlude/2 con tema sin escena"] = { make: () => R(Interlude, { spec: SPEC, done: 1, skip: [1] }), frames: interludeFrames(SPEC) };
PIECES["Interlude/2 con tema visto sin escena"] = { make: () => R(Interlude, { spec: { ...SPEC, topics: SPEC.topics.map((t, i) => (i === 1 ? { ...t, seen: true } : t)), design: { gradient: { loop: 45 } } }, done: 1, skip: [1] }), frames: interludeFrames(SPEC) };
PIECES["Interlude/renglon"] = { make: () => R(Interlude, { spec: SPECS.renglon!, done: 2 }), frames: interludeFrames(SPEC) };
PIECES["InterludeCompact/1"] = { make: () => R(InterludeCompact, { spec: SPEC, done: 1 }), frames: interludeCompactFrames(SPEC) };
PIECES["InterludeCompact/3"] = { make: () => R(InterludeCompact, { spec: SPEC, done: 3 }), frames: interludeCompactFrames(SPEC) };
// piezas compartidas: un cuadro fijo, sin animación propia
const Row = () => {
  const L = listLayout(SPEC, neutral, 1920, 1080);
  return R(HeadlineRow, { i: 0, L, underline: 1 });
};
PIECES["Chip"] = { make: () => R(Chip, { text: "Etiqueta", lit: 1, pop: 0 }), frames: 60 };
PIECES["Pill"] = { make: () => R(Pill, { index: 0, name: "Un tema" }), frames: 60 };
PIECES["HeadlineRow"] = { make: () => R(Row), frames: 60 };
PIECES["CheckMark"] = { make: () => R(CheckMark, { p: 1, size: 40, id: "x" }), frames: 60 };

/** Cuadros que se miran de una pieza: el principio, el final y unos cuantos parejos en el medio. */
const framesOf = (n: number) => Array.from(new Set([0, 1, 2, ...Array.from({ length: 12 }, (_, i) => Math.round(((i + 1) * (n - 1)) / 12)), n - 1])).sort((a, b) => a - b);

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});
afterEach(() => vi.restoreAllMocks());

/** Marcado del cuadro `f` en una raíz que ya pasó por los cuadros de `before`. */
function htmlAfter(el: React.ReactElement, before: number[], f: number, cfg = config): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  for (const n of [...before, f]) flushSync(() => root.render(tree(el, n, cfg)));
  const out = host.innerHTML;
  root.unmount();
  return out;
}

/**
 * Quita los `transform` de cámara: las capas 3D (llevan `perspective(`) y el mundo de `World` (`translate(..) scale(..) translate(..)`):
 * ahí el `transform` lleva siempre la cuenta entera aunque la cámara esté quieta.
 */
const without3d = (markup: string) => markup.replace(/transform:[^;"]*perspective\([^;"]*/g, "transform:3d").replace(/transform:\s*translate\([^)]*\)\s*scale\([^)]*\)\s*translate\([^)]*\)/g, "transform:world");

describe("piezas de stories: reposo e historial", () => {
  for (const [name, piece] of Object.entries(PIECES)) {
    const cfg = { ...config, durationInFrames: piece.frames };
    it(`${name}: el marcado de cada cuadro no depende del historial`, { timeout: 120_000 }, () => {
      const el = piece.make();
      const last = piece.frames - 1;
      for (const f of framesOf(piece.frames)) {
        const fresh = htmlAfter(el, [], f, cfg);
        for (const before of [[last], [0, last], [Math.floor(last / 2), last, 0], [f === 0 ? 1 : 0]]) {
          expect(htmlAfter(el, before, f, cfg), `${name} cuadro ${f} tras ${before}`).toBe(fresh);
        }
      }
    });
    it(`${name}: no deja transformaciones identidad, desenfoque 0 ni opacidad casi 1`, () => {
      const el = piece.make();
      for (const f of framesOf(piece.frames)) {
        const markup = without3d(htmlAfter(el, [], f, cfg));
        // con contexto (30 caracteres antes) para ver de qué elemento se trata
        const find = (re: RegExp) => [...markup.matchAll(re)].map((m) => markup.slice(Math.max(0, m.index! - 60), m.index! + m[0].length));
        const leftovers = [
          ...find(/translate(?:X|Y|3d)?\(\s*-?0(?:\.0+)?(?:px|%)?\s*(?:,\s*-?0(?:\.0+)?(?:px|%)?\s*)*\)/g),
          ...find(/scale(?:X|Y)?\(\s*1(?:\.0+)?\s*(?:,\s*1(?:\.0+)?\s*)?\)/g),
          ...find(/rotate[XYZ]?\(\s*-?0(?:\.0+)?(?:deg)?\s*\)/g),
          ...find(/blur\(\s*0(?:\.0+)?(?:px)?\s*\)/g),
          // opacidad "casi 1" que sobra de una cuenta (0,9995 o más): un fundido que va por 0,98 es legítimo
          ...find(/opacity:\s*0\.(?:9995|999[6-9])\d*/g),
          ...find(/opacity="0\.(?:9995|999[6-9])\d*"/g),
        ];
        expect(leftovers.slice(0, 6), `${name} cuadro ${f}`).toEqual([]);
      }
    });
  }
});
