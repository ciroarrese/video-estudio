import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider, useFrame } from "../engine";
import { ThemeProvider, neutral } from "../themes";
import { Loop, fxDensity, loopState, LineDraw, TileDone, NotificationStack, DigitRoll, CardFlip, FlowSteps, RadarMorph, ChatThread, CommandPalette, BeforeAfter, MarkerDraw } from "./index";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 400 };
const html = (node: React.ReactNode, frame: number) =>
  renderToString(<FrameProvider frame={frame} config={config}><ThemeProvider theme={neutral}>{node}</ThemeProvider></FrameProvider>);

const Frame = () => <i data-f={useFrame()} />;

describe("loopState", () => {
  it("fade: anima, se queda quieto, se funde al final de la pausa y la vuelta siguiente entra con fundido", () => {
    const o = { duration: 60, pause: 20, fadeOut: 8, fadeIn: 6 };
    expect(loopState(0, o)).toMatchObject({ local: 0, index: 0, phase: "play", opacity: 1, cycle: 80 });
    expect(loopState(30, o).local).toBe(30);
    expect(loopState(65, o)).toMatchObject({ local: 60, phase: "hold", opacity: 1 });
    expect(loopState(76, o).opacity).toBeCloseTo(0.5, 5); // a mitad del fundido de salida
    expect(loopState(80, o)).toMatchObject({ local: 0, index: 1, opacity: 0 }); // la vuelta siguiente entra desde 0
    expect(loopState(83, o).opacity).toBeCloseTo(0.5, 5);
    expect(loopState(86, o).opacity).toBe(1);
    expect(loopState(5, o).opacity).toBe(1); // la primera vuelta no se funde
    expect(loopState(5, { ...o, fadeFirst: true }).opacity).toBeCloseTo(5 / 6, 3);
  });
  it("restart no funde y reinicia en seco", () => {
    const o = { duration: 40, pause: 10, mode: "restart" as const };
    expect(loopState(49, o)).toMatchObject({ local: 40, opacity: 1 });
    expect(loopState(50, o)).toMatchObject({ local: 0, index: 1, opacity: 1 });
  });
  it("pingpong: va, se queda y vuelve por el mismo camino, sin fundidos", () => {
    const o = { duration: 40, pause: 10, mode: "pingpong" as const };
    expect(loopState(0, o).cycle).toBe(90);
    expect(loopState(20, o)).toMatchObject({ local: 20, phase: "play" });
    expect(loopState(45, o)).toMatchObject({ local: 40, phase: "hold" });
    expect(loopState(60, o)).toMatchObject({ local: 30, phase: "back" });
    expect(loopState(89, o).local).toBe(1);
    expect(loopState(90, o)).toMatchObject({ local: 0, index: 1, phase: "play" });
    for (let f = 0; f < 200; f++) expect(loopState(f, o).opacity).toBe(1);
  });
  it("offset adelanta el ciclo y start lo atrasa; times termina en la imagen final", () => {
    expect(loopState(0, { duration: 60, pause: 20, offset: 30 }).local).toBe(30);
    expect(loopState(100, { duration: 60, pause: 20, start: 100 }).local).toBe(0);
    expect(loopState(10, { duration: 60, pause: 20, start: 100 }).local).toBe(0);
    const t = { duration: 60, pause: 20, times: 2 };
    expect(loopState(200, t)).toMatchObject({ local: 60, phase: "done", opacity: 1 });
    expect(loopState(150, t).opacity).toBe(1); // la última vuelta no se funde al final
  });
  it("es pura: el mismo cuadro da el mismo estado sin importar el orden", () => {
    const o = { duration: 50, pause: 15, offset: 7 };
    const a = [10, 400, 3, 77, 10].map((f) => loopState(f, o));
    expect(a[0]).toEqual(a[4]);
  });
});

describe("Loop", () => {
  it("los hijos ven el cuadro local; el contenedor solo lleva opacity mientras funde", () => {
    const at = (f: number) => html(<Loop duration={60} pause={20}><Frame /></Loop>, f);
    expect(at(10)).toContain('data-f="10"');
    expect(at(70)).toContain('data-f="60"');
    expect(at(90)).toContain('data-f="10"'); // vuelta siguiente
    expect(at(30)).not.toMatch(/opacity/);
    expect(at(76)).toMatch(/opacity:0\.5/);
    expect(at(70)).not.toMatch(/opacity/);
  });
  it("acepta una función hija con el cuadro local y el número de vuelta", () => {
    const out = html(<Loop duration={30} pause={0} mode="restart">{(l, s) => <b data-l={l} data-i={s.index} />}</Loop>, 75);
    expect(out).toContain('data-l="15"');
    expect(out).toContain('data-i="2"');
  });
  it("el marcado no depende del historial de cuadros", () => {
    const node = <Loop duration={60} pause={20}><LineDraw start={0} duration={60} /></Loop>;
    const seq = [5, 76, 30, 5, 90];
    const first = seq.map((f) => html(node, f));
    const again = [...seq].reverse().map((f) => html(node, f)).reverse();
    expect(again).toEqual(first);
  });
});

describe("density", () => {
  it("sin density, o con 1, el marcado es el de siempre", () => {
    const fxs: [string, (d?: any) => React.ReactElement][] = [
      ["LineDraw", (d) => <LineDraw density={d} />], ["TileDone", (d) => <TileDone density={d} />], ["NotificationStack", (d) => <NotificationStack density={d} />],
      ["DigitRoll", (d) => <DigitRoll value={1200} density={d} />], ["CardFlip", (d) => <CardFlip density={d} />], ["FlowSteps", (d) => <FlowSteps density={d} />], ["RadarMorph", (d) => <RadarMorph density={d} />],
      ["ChatThread", (d) => <ChatThread density={d} />], ["CommandPalette", (d) => <CommandPalette density={d} />], ["BeforeAfter", (d) => <BeforeAfter density={d} />], ["MarkerDraw", (d) => <MarkerDraw density={d} />],
    ];
    for (const [name, make] of fxs) for (const f of [0, 20, 45, 80, 200]) expect(html(make(1), f), `${name} ${f}`).toBe(html(make(undefined), f));
  });
  it("fxDensity: auto sigue la caja, nunca agranda y tiene piso", () => {
    expect(fxDensity(undefined, { width: 100, height: 100 }, { width: 900, height: 520 })).toBe(1);
    expect(fxDensity("auto", { width: 450, height: 520 }, { width: 900, height: 520 })).toBe(0.5);
    expect(fxDensity("auto", { width: 1800, height: 1040 }, { width: 900, height: 520 })).toBe(1);
    expect(fxDensity("auto", { width: 10, height: 10 }, { width: 900, height: 520 })).toBe(0.3);
    expect(fxDensity(0.5, { width: 10, height: 10 }, { width: 900, height: 520 })).toBe(0.5);
    expect(fxDensity(9, { width: 10, height: 10 }, { width: 900, height: 520 })).toBe(2);
  });
  it("en una caja chica con auto, nada queda con medidas negativas ni NaN", () => {
    const box = { width: 330, height: 150 };
    for (const el of [<LineDraw {...box} density="auto" />, <TileDone {...box} density="auto" />, <NotificationStack {...box} density="auto" />, <CardFlip {...box} density="auto" />, <FlowSteps {...box} density="auto" />, <RadarMorph {...box} density="auto" />, <ChatThread {...box} density="auto" />, <CommandPalette {...box} density="auto" />, <BeforeAfter {...box} density="auto" />, <MarkerDraw {...box} density="auto" />]) {
      for (const f of [0, 30, 100]) {
        const h = html(el, f);
        expect(h).not.toMatch(/NaN|Infinity|="-\d/);
      }
    }
  });
  it("CommandPalette y ChatThread: con auto, la caja de búsqueda y las burbujas bajan con la caja (y sin density siguen iguales)", () => {
    const small = html(<CommandPalette width={330} height={150} density="auto" />, 60);
    const big = html(<CommandPalette width={330} height={150} />, 60);
    expect(small).toContain('width="9.6"'); // lupa: 32 * 0,3
    expect(big).toContain('width="32"');
    expect(html(<ChatThread width={330} height={150} density="auto" />, 100)).not.toBe(html(<ChatThread width={330} height={150} />, 100));
  });
  it("RadarMorph: con auto, el radar de una caja chica se dibuja", () => {
    const small = html(<RadarMorph width={330} height={150} density="auto" />, 100);
    expect(small).toContain("<path");
  });
});
