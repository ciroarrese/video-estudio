import { describe, expect, it } from "vitest";
import { coverRadius, wipeFraction } from "./DotWipe";
import { rayPoly, shapePoints } from "./ShapeMorph";
import { markerPoints } from "./MarkerDraw";
import { tornStrip } from "./PaperCollage";
import { fallbackCells } from "./PixelBuild";
import { landPhases } from "./LogoLand";
import { sealAngle } from "./SealSpin";
import { ribbonQuad } from "./RibbonTwist";
import { ballPositions } from "./LiquidBlob";
import { halftoneRadius } from "./HalftoneWave";
import { shapePolyline } from "./BlueprintDraw";
import { morphPoints, polyLength } from "../data/geom";

describe("art maths", () => {
  it("dot wipe", () => {
    expect(coverRadius(100, 100, 0, 0)).toBeCloseTo(Math.hypot(100, 100));
    expect(wipeFraction("in", 0)).toBe(0);
    expect(wipeFraction("in", 1)).toBe(1);
    expect(wipeFraction("out", 1)).toBe(0);
    expect(wipeFraction("inout", 0.5)).toBeCloseTo(1);
    expect(wipeFraction("inout", 1)).toBeCloseTo(0);
  });
  it("shapes have equal point counts and morph linearly", () => {
    const a = shapePoints("circle", 100), b = shapePoints("star", 100);
    expect(a).toHaveLength(b.length);
    expect(a[0]!.y).toBeCloseTo(-100);
    const m = morphPoints(a, b, 0.5);
    expect(m[10]!.x).toBeCloseTo((a[10]!.x + b[10]!.x) / 2);
    expect(shapePoints({ superellipse: 4 }, 50)).toHaveLength(96);
    expect(rayPoly([{ x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }, { x: -10, y: -10 }], 0)).toBeCloseTo(10);
  });
  it("marker and torn paper are deterministic", () => {
    expect(markerPoints("circle", 200, 100, "a")).toEqual(markerPoints("circle", 200, 100, "a"));
    expect(markerPoints("circle", 200, 100, "a")).not.toEqual(markerPoints("circle", 200, 100, "b"));
    expect(tornStrip(100, 40, "x")).toEqual(tornStrip(100, 40, "x"));
  });
  it("pixel fallback and landing phases", () => {
    const f = fallbackCells("42", 8, "s");
    expect(f.cells.length).toBeGreaterThan(10);
    expect(f.cells.every((c) => c.c < f.cols && c.r < f.rows)).toBe(true);
    expect(landPhases(1).ring).toBeCloseTo(1);
    expect(landPhases(1).drop).toBe(1);
    expect(landPhases(0).strokes).toBe(0);
  });
  it("seal rests at 0, ribbon face flips, blobs settle, halftone in range", () => {
    expect(sealAngle(1)).toBeCloseTo(0);
    expect(sealAngle(0, 2)).toBe(-720);
    const front = ribbonQuad({ x: 0, y: 0 }, { x: 10, y: 0 }, 0, 0, 20);
    const back = ribbonQuad({ x: 0, y: 0 }, { x: 10, y: 0 }, Math.PI, Math.PI, 20);
    expect(front.front).toBe(true);
    expect(back.front).toBe(false);
    expect(ballPositions(5, 900, 560, 1)).toEqual(ballPositions(5, 900, 560, 1));
    for (let x = 0; x < 300; x += 17) { const r = halftoneRadius(x, 5, 1, 0.5, 360); expect(r).toBeGreaterThan(0); expect(r).toBeLessThanOrEqual(1); }
  });
  it("blueprint polylines", () => {
    expect(polyLength(shapePolyline({ type: "rect", x: 0, y: 0, w: 10, h: 5 }))).toBe(30);
    expect(polyLength(shapePolyline({ type: "circle", cx: 0, cy: 0, r: 10 }))).toBeGreaterThan(60);
    expect(shapePolyline({ type: "path", d: "M0 0 L10 0" })).toHaveLength(2);
  });
});
