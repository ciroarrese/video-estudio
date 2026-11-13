import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../../engine";
import { ThemeProvider, dark, neutral } from "../../themes";
import type { Theme } from "../../themes";
import {
  DigitRoll, KineticWords, MarqueeBands, MaskedRise, ScrambleDecode, SplitFlap, TypeRing, Typewriter,
  digitCount, fitText, flapPlan, marqueeShift, projectRing, scrambleAt, splitFlapDuration, wheelPos,
} from "./index";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 900 };
const html = (node: React.ReactNode, frame: number, theme: Theme = neutral) =>
  renderToString(
    <FrameProvider frame={frame} config={config}>
      <ThemeProvider theme={theme}>{node}</ThemeProvider>
    </FrameProvider>,
  );
const text = (h: string) => h.replace(/<[^>]+>/g, "");

describe("fx/text", () => {
  it("MaskedRise: hidden at 0, composed at the end, themed", () => {
    const el = <MaskedRise text="Hola mundo" dot />;
    expect(html(el, 0)).toMatch(/translateY\([1-9]\d*px\)/);
    const last = html(el, 200);
    expect(last).not.toContain("translateY(0px)");
    expect(last).not.toMatch(/translateY\([1-9]\d*px\)\"?>[A-Za-z]/);
    expect(text(last)).toBe("Holamundo");
    expect(last).toContain(neutral.color.accent);
    expect(html(el, 200, dark)).toContain(dark.color.accent);
    expect(html(el, 200, dark)).not.toContain(neutral.color.accent);
    expect(html(<MaskedRise text="Hola" frame={13} start={10} />, 0)).toBe(html(<MaskedRise text="Hola" />, 3));
  });
  it("KineticWords: hard cuts, one word per slice, last word stays", () => {
    const el = <KineticWords words={["Uno", "Dos", "Tres"]} duration={60} />;
    expect(text(html(el, 5))).toBe("Uno");
    expect(text(html(el, 25))).toBe("Dos");
    expect(text(html(el, 59))).toBe("Tres");
    expect(text(html(el, 500))).toBe("Tres");
    expect(html(el, 5)).toContain(neutral.color.bg);
    expect(html(el, 25)).toContain(neutral.color.accent);
  });
  it("Typewriter: types, caret off and extra element at the end", () => {
    const el = <Typewriter text="abcdef" duration={12} after={<b>ok</b>} />;
    expect(html(el, 0)).toContain("opacity:0");
    const mid = html(el, 6);
    expect(mid).toMatch(/<span>abc<\/span>/);
    expect(html(el, 100)).toContain("<span>abcdef</span>");
    expect(html(el, 100)).toContain("translateY(0px)");
  });
  it("ScrambleDecode: deterministic, resolves left to right, final is exact", () => {
    expect(scrambleAt("Hola", 10, 40, "s")).toBe(scrambleAt("Hola", 10, 40, "s"));
    expect(scrambleAt("Hola", 10, 40, "s")).not.toBe(scrambleAt("Hola", 10, 40, "t"));
    expect(scrambleAt("Hola", 40, 40, "s")).toBe("Hola");
    expect(scrambleAt("Hola mundo", 0, 40, "s")[4]).toBe(" ");
    expect(text(html(<ScrambleDecode text="Hola" duration={20} />, 99))).toBe("Hola");
  });
  it("SplitFlap: seeded flips, settles on the final text", () => {
    const n = 7;
    const flips = Array.from({ length: n }, (_, i) => flapPlan("A", i, n, "x", splitFlapDuration(n)).seq.length - 1);
    expect(flips.every((f) => f >= 2 && f <= 5)).toBe(true);
    expect(flips).toEqual(Array.from({ length: n }, (_, i) => flapPlan("A", i, n, "x", splitFlapDuration(n)).seq.length - 1));
    const last = html(<SplitFlap text="Sale" />, 200);
    expect(text(last).replace(/ /g, "")).toBe("SSAALLEE");
    const plan = flapPlan("Z", 3, n, "x", 40);
    expect(plan.delay + (plan.seq.length - 1) * plan.flipDur).toBeLessThanOrEqual(40);
  });
  it("DigitRoll: fixed slots and exact final number", () => {
    expect(digitCount(48250)).toBe(5);
    expect(wheelPos(1234, 0)).toBeCloseTo(1234);
    expect(wheelPos(19, 1) % 10).toBeLessThan(2);
    const el = <DigitRoll value={48250} suffix="%" duration={30} />;
    const a = html(el, 0);
    const b = html(el, 15);
    const c = html(el, 100);
    // mismo numero de ranuras (anchos fijos) en todos los cuadros
    const slots = (h: string) => (h.match(/data-qa-ignore/g) ?? []).length;
    expect(slots(a)).toBe(5);
    expect(slots(b)).toBe(5);
    expect(slots(c)).toBe(5);
    expect(c).toContain("translateY(-792px)");
    expect(c).toContain("translateY(0px)");
    expect(text(c)).toContain("%");
  });
  it("MarqueeBands: opposite directions, loops, frozen after duration", () => {
    expect(marqueeShift(0, 100, -1)).toBeCloseTo(0);
    expect(marqueeShift(30, 100, -1)).toBe(-30);
    expect(marqueeShift(30, 100, 1)).toBe(-70);
    expect(marqueeShift(130, 100, -1)).toBe(-30);
    const el = <MarqueeBands lines={["A", "B"]} duration={30} />;
    expect(html(el, 200)).toBe(html(el, 900));
    expect(html(el, 10)).not.toBe(html(el, 20));
  });
  it("TypeRing: back letters dimmer, mirrored and squeezed; painted far to near", () => {
    const letters = Array.from("ABCDEFGHIJKLMNOPQRSTUVWX");
    const g = projectRing(letters, { cx: 0, cy: 0, radius: 100, tilt: 15, angle: 0, textLen: 24 });
    for (let i = 1; i < g.length; i++) expect(g[i]!.z).toBeGreaterThanOrEqual(g[i - 1]!.z);
    const back = g.find((q) => q.squeeze < -0.9)!;
    const front = g[g.length - 1]!;
    expect(back.alpha).toBeCloseTo(0.16);
    expect(front.alpha).toBeGreaterThan(0.9);
    expect(front.squeeze).toBeGreaterThan(0.95);
    expect(front.scale).toBeGreaterThan(back.scale);
    const side = g.find((q) => Math.abs(q.squeeze) < 0.2)!;
    expect(Math.abs(side.squeeze)).toBeLessThan(0.2);
    expect(html(<TypeRing text="Hola" />, 0)).toContain("<canvas");
  });
  it("fitText: scales to the width within bounds (jsdom estimate)", () => {
    const font = { family: "sans-serif" };
    const m = (t: string, fs: number) => t.length * fs * 0.5;
    expect(fitText("abcd", 100, { font, max: 500, measure: m })).toBeCloseTo(50);
    expect(fitText("abcd", 100, { font, max: 30, measure: m })).toBe(30);
    expect(fitText("abcd", 10, { font, max: 30, min: 12, measure: m })).toBe(12);
    const f = fitText("Una frase larga", 400, { font, max: 200 });
    expect(f).toBeGreaterThan(10);
    expect(f).toBeLessThan(200);
  });
});
