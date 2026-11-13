import { describe, expect, it } from "vitest";
import { clip, lerp, mix, phases, progress, seededShuffle, stagger, staggerBy, sub } from "./index";

describe("fx/core", () => {
  it("progress clamps and eases", () => {
    expect(progress(-5, 10, 20)).toBe(0);
    expect(progress(20, 10, 20)).toBe(0.5);
    expect(progress(99, 10, 20)).toBe(1);
    expect(progress(10, 10, 0)).toBe(1);
    expect(progress(9, 10, 0)).toBe(0);
    expect(progress(20, 10, 20, (t) => t * t)).toBe(0.25);
  });
  it("phases", () => {
    expect(phases(15, [{ at: 0, dur: 10 }, { at: 10, dur: 10 }])).toEqual([1, 0.5]);
  });
  it("stagger variants", () => {
    expect(stagger(3, { each: 2 })).toBe(6);
    expect(stagger(0, { each: 2, from: "end", total: 4 })).toBe(6);
    expect(stagger(1, { each: 2, from: "center", total: 4 })).toBe(1);
    expect(stagger(0, { each: 2, from: "center", total: 5 })).toBe(4);
    expect(stagger(5, { each: 3, from: 2 })).toBe(9);
    expect(() => stagger(0, { each: 1, from: "end" })).toThrow();
    expect(staggerBy(-10, 0.5)).toBe(5);
  });
  it("clip", () => {
    expect(clip(5, { start: 10, duration: 20 })).toMatchObject({ t: 0, done: false, active: false });
    expect(clip(20, { start: 10, duration: 20 })).toMatchObject({ t: 0.5, done: false, active: true });
    expect(clip(35, { start: 10, duration: 20, holdAfter: 10 })).toMatchObject({ t: 1, done: true, active: true, end: 40 });
    expect(clip(40, { start: 10, duration: 20, holdAfter: 10 }).active).toBe(false);
    expect(sub(0.5, 0.25, 0.75)).toBe(0.5);
  });
  it("seededShuffle is a deterministic permutation", () => {
    const a = seededShuffle(20, "x");
    expect(a).toEqual(seededShuffle(20, "x"));
    expect([...a].sort((p, q) => p - q)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(a).not.toEqual(seededShuffle(20, "y"));
  });
  it("lerp and mix", () => {
    expect(lerp(0, 10, 0.3)).toBeCloseTo(3);
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("nope", "#ffffff", 0.5)).toBe("nope");
  });
});
