import { describe, expect, it } from "vitest";
import { catmullRom, niceTicks, pointAt, polyLength, trimPolyline, parsePath, resample, morphPoints, roundedPolyline } from "./geom";
import { lineLayout } from "./LineDraw";
import { donutArc } from "./DonutRing";
import { radarValues, radarPoints } from "./RadarMorph";
import { boxFaces, iso } from "./Bars3D";
import { staggerT } from "./geom";

describe("geom", () => {
  const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  it("polyLength / pointAt / trim", () => {
    expect(polyLength(sq)).toBe(20);
    expect(pointAt(sq, 0.75)).toMatchObject({ x: 10, y: 5 });
    const t = trimPolyline(sq, 0.25);
    expect(t).toHaveLength(2);
    expect(t[1]).toEqual({ x: 5, y: 0 });
    expect(trimPolyline(sq, 1)).toBe(sq);
    expect(polyLength(trimPolyline(sq, 0.6))).toBeCloseTo(12);
  });
  it("catmullRom passes through the points", () => {
    const c = catmullRom(sq, 4);
    expect(c[0]).toEqual(sq[0]);
    expect(c[c.length - 1]).toEqual(sq[2]);
    expect(c.some((q) => Math.abs(q.x - 10) < 1e-9 && Math.abs(q.y) < 1e-9)).toBe(true);
  });
  it("niceTicks", () => {
    expect(niceTicks(87, 4)).toEqual({ max: 100, ticks: [0, 25, 50, 75, 100] });
    expect(niceTicks(64, 4).max).toBe(80);
  });
  it("parsePath handles commands, relative moves and arcs", () => {
    const [a] = parsePath("M0 0 H10 v10 l-10 0 z");
    expect(a![a!.length - 1]).toEqual({ x: 0, y: 0 });
    const arc = parsePath("M0 0 A10 10 0 0 1 20 0")[0]!;
    expect(arc[arc.length - 1]!.x).toBeCloseTo(20);
    expect(Math.min(...arc.map((q) => q.y))).toBeCloseTo(-10, 0);
  });
  it("resample and morph", () => {
    const r = resample(sq, 5);
    expect(r).toHaveLength(5);
    expect(morphPoints([{ x: 0, y: 0 }], [{ x: 10, y: 20 }], 0.5)[0]).toEqual({ x: 5, y: 10 });
    expect(() => morphPoints(sq, [sq[0]!], 0.5)).toThrow();
  });
  it("roundedPolyline keeps ends", () => {
    const r = roundedPolyline(sq, 4);
    expect(r[0]).toEqual(sq[0]);
    expect(r[r.length - 1]).toEqual(sq[2]);
  });
  it("staggerT ends at 1 for every item", () => {
    for (let i = 0; i < 5; i++) expect(staggerT(1, i, 5, 0.6)).toBe(1);
    expect(staggerT(0, 3, 5)).toBe(0);
  });
});

describe("chart maths", () => {
  it("lineLayout maps data inside the plot area", () => {
    const L = lineLayout([0, 50, 100], 900, 520);
    expect(L.pts[0]!.y).toBeCloseTo(L.y0);
    expect(L.pts[2]!.y).toBeCloseTo(L.y1);
    expect(L.curve.every((q) => q.y >= L.y1 - 1e-6 && q.y <= L.y0 + 1e-6)).toBe(true);
  });
  it("donutArc", () => {
    expect(donutArc(0.5).sweepDeg).toBe(180);
    expect(donutArc(2).sweepDeg).toBe(360);
    expect(donutArc(0.25).a1).toBeCloseTo(0);
  });
  it("radar interpolation and vertices", () => {
    expect(radarValues([0, 1], [1, 0], 0.25)).toEqual([0.25, 0.75]);
    expect(() => radarValues([1], [1, 2], 0)).toThrow();
    const p = radarPoints(0, 0, 100, [1, 1, 1, 1]);
    expect(p[0]!.y).toBeCloseTo(-100);
    expect(p[1]!.x).toBeCloseTo(100);
  });
  it("iso boxes: taller box raises the top", () => {
    expect(iso(0, 0, 10).y).toBe(-10);
    const f = boxFaces(0, 0, 10, 10, 30);
    expect(f.top[0]!.y).toBe(-30);
    expect(f.front[0]!.y).toBe(iso(0, 10, 0).y);
  });
});
