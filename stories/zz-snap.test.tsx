// TEMPORAL: instantánea del marcado para comprobar identidad con el tema por defecto. Se borra al terminar.
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { beforeAll, it } from "vitest";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral, dark } from "../themes";
import type { StorySpec } from "./index";
const dir = process.env.SNAP_DIR!;
const S: any = await import(/* @vite-ignore */ `${dir}/index`);
const SH: any = await import(/* @vite-ignore */ `${dir}/shared`);
const LY: any = await import(/* @vite-ignore */ `${dir}/layout`);
const { Closing, Interlude, InterludeCompact, Opening, closingFrames, interludeCompactFrames, interludeFrames, openingFrames } = S;
const { CheckMark, Chip, HeadlineRow, Pill } = SH;
const { listLayout } = LY;
const norm = (h: string) => h.replace(/-?\d+\.\d{3,}/g, (m) => String(+(+m).toFixed(2)));

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
};
const R = React.createElement;
const SIZES: Record<string, [number, number]> = { h: [1920, 1080], v: [1080, 1920], c: [1080, 1080] };
type Piece = { make: () => React.ReactElement; frames: number };
const PIECES: Record<string, Piece> = {};
for (const [k, spec] of Object.entries(SPECS)) {
  PIECES[`Opening/${k}`] = { make: () => R(Opening, { spec }), frames: openingFrames(spec) };
  PIECES[`Closing/${k}`] = { make: () => R(Closing, { spec }), frames: closingFrames(spec) };
}
PIECES["Interlude/1"] = { make: () => R(Interlude, { spec: SPEC, done: 1 }), frames: interludeFrames(SPEC) };
PIECES["Interlude/3"] = { make: () => R(Interlude, { spec: SPEC, done: 3 }), frames: interludeFrames(SPEC) };
PIECES["Interlude/skip"] = { make: () => R(Interlude, { spec: SPEC, done: 1, skip: [1] }), frames: interludeFrames(SPEC) };
PIECES["Interlude/renglon"] = { make: () => R(Interlude, { spec: SPECS.renglon!, done: 2 }), frames: interludeFrames(SPEC) };
PIECES["Compact/1"] = { make: () => R(InterludeCompact, { spec: SPEC, done: 1 }), frames: interludeCompactFrames(SPEC) };
PIECES["Compact/3"] = { make: () => R(InterludeCompact, { spec: SPEC, done: 3 }), frames: interludeCompactFrames(SPEC) };
const Row = () => R(HeadlineRow, { i: 0, L: listLayout(SPEC, neutral, 1920, 1080), underline: 1 });
PIECES["Chip"] = { make: () => R(Chip, { text: "Etiqueta", lit: 1, pop: 0.5 }), frames: 30 };
PIECES["Pill"] = { make: () => R(Pill, { index: 0, name: "Un tema" }), frames: 30 };
PIECES["Row"] = { make: () => R(Row), frames: 30 };
PIECES["Check"] = { make: () => R(CheckMark, { p: 0.6, size: 40, id: "x" }), frames: 30 };

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false; });

it("snap", { timeout: 900_000 }, () => {
  const out: Record<string, string> = {};
  for (const [tn, theme] of [["neutral", neutral], ["dark", dark]] as const) {
    for (const [sn, [width, height]] of Object.entries(SIZES)) {
      for (const [name, piece] of Object.entries(PIECES)) {
        const cfg = { fps: 30, width, height, durationInFrames: piece.frames };
        const frames = new Set<number>([0, 1, piece.frames - 1]);
        for (let f = 0; f < piece.frames; f += 11) frames.add(f);
        const host = document.createElement("div");
        const root = createRoot(host);
        for (const f of [...frames].sort((a, b) => a - b)) {
          flushSync(() => root.render(<FrameProvider frame={f} config={cfg}><ThemeProvider theme={theme}>{piece.make()}</ThemeProvider></FrameProvider>));
          out[`${tn}/${sn}/${name}/${f}`] = createHash("sha1").update(norm(host.innerHTML)).digest("hex");
        }
        root.unmount();
      }
    }
  }
  writeFileSync(process.env.SNAP_OUT!, JSON.stringify(out, null, 0));
});
