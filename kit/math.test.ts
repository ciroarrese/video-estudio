import { describe, expect, it } from "vitest";
import { arrowPoints, cameraAt, circlePoints, flight, hideFromScale, kf, track, typed, underlinePoints, zoomThrough } from "./index";
import type { CameraKey } from "./index";

describe("kf / track / typed", () => {
  it("kf hits keys and clamps", () => {
    expect(kf(0, [0, 10, 20], [0, 5, 1])).toBe(0);
    expect(kf(10, [0, 10, 20], [0, 5, 1])).toBeCloseTo(5);
    expect(kf(99, [0, 10, 20], [0, 5, 1])).toBe(1);
    expect(kf(-5, [0, 10], [3, 4])).toBe(3);
  });
  it("track interpolates 2D stops", () => {
    const s: [number, number, number][] = [[0, 0, 0], [10, 100, 50]];
    expect(track(0, s)).toEqual({ x: 0, y: 0 });
    expect(track(10, s)).toEqual({ x: 100, y: 50 });
    const mid = track(5, s);
    expect(mid.x).toBeCloseTo(50);
    expect(mid.y).toBeCloseTo(25);
  });
  it("typed reveals characters", () => {
    expect(typed("hola", 5, 10, 1)).toBe("");
    expect(typed("hola", 12, 10, 1)).toBe("ho");
    expect(typed("hola", 100, 10, 1)).toBe("hola");
  });
});

const still: CameraKey[] = [{ f: 0, x: 500, y: 300, scale: 1.2 }, { f: 100, x: 500, y: 300, scale: 1.2 }];

describe("cameraAt", () => {
  it("static camera has zero tilt and blur", () => {
    const c = cameraAt(50, still);
    expect(c.rx).toBeCloseTo(0);
    expect(c.ry).toBeCloseTo(0);
    expect(c.blur).toBe(0);
  });
  it("returns the key values at keys", () => {
    const keys: CameraKey[] = [{ f: 0, x: 0, y: 0, scale: 1 }, { f: 20, x: 800, y: 400, scale: 2 }];
    expect(cameraAt(0, keys)).toMatchObject({ x: 0, y: 0, scale: 1 });
    expect(cameraAt(20, keys)).toMatchObject({ x: 800, y: 400, scale: 2 });
  });
  it("fast move: blur and tilt are capped", () => {
    const keys: CameraKey[] = [{ f: 0, x: 0, y: 0, scale: 1 }, { f: 2, x: 20000, y: 20000, scale: 1 }];
    const c = cameraAt(1, keys, { maxBlur: 5, maxTilt: 6 });
    expect(c.blur).toBe(5);
    expect(Math.abs(c.rx)).toBe(6);
    expect(Math.abs(c.ry)).toBe(6);
  });
  it("moderate move gives some blur; noBlurFrom disables it", () => {
    const keys: CameraKey[] = [{ f: 0, x: 0, y: 0, scale: 1 }, { f: 10, x: 400, y: 0, scale: 1 }];
    const linearish = cameraAt(5, keys);
    expect(linearish.blur).toBeGreaterThan(0);
    expect(cameraAt(5, keys, { noBlurFrom: 3 }).blur).toBe(0);
  });
});

describe("zoomThrough", () => {
  it("scale is monotonic and untouched before start", () => {
    const cam = { x: 100, y: 100, scale: 1 };
    const tgt = { x: 500, y: 500 };
    expect(zoomThrough(10, [20, 60], cam, tgt)).toEqual(cam);
    let prev = 0;
    for (let f = 20; f <= 60; f++) {
      const s = zoomThrough(f, [20, 60], cam, tgt, 50).scale;
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
    expect(prev).toBeCloseTo(50);
    expect(zoomThrough(60, [20, 60], cam, tgt).x).toBe(500);
  });
});

describe("flight", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 0 };
  it("hits its endpoints and clamps", () => {
    expect(flight(0, [10, 30], from, to, { arc: 50 })).toMatchObject({ x: 0, y: 0, t: 0 });
    const end = flight(30, [10, 30], from, to, { arc: 50 });
    expect(end.x).toBeCloseTo(100);
    expect(end.y).toBeCloseTo(0);
    expect(flight(99, [10, 30], from, to).x).toBeCloseTo(100);
  });
  it("arcs away from the straight line mid-flight", () => {
    const mid = flight(20, [10, 30], from, to, { arc: 50 });
    expect(Math.abs(mid.y)).toBeCloseTo(50, 0);
    expect(flight(20, [10, 30], from, to).y).toBeCloseTo(0);
  });
});

describe("hideFromScale", () => {
  it("ramps 0..1", () => {
    expect(hideFromScale(0.8)).toBe(0);
    expect(hideFromScale(1)).toBe(0);
    expect(hideFromScale(1.04)).toBeCloseTo(0.5);
    expect(hideFromScale(2)).toBe(1);
    expect(hideFromScale(1.5, 1.2, 0.2)).toBe(1);
  });
});

describe("doodle determinism", () => {
  it("same frame same path; boils after N frames", () => {
    expect(circlePoints("a", 10, 0, 0, 50, 20)).toBe(circlePoints("a", 10, 0, 0, 50, 20));
    expect(circlePoints("a", 10, 0, 0, 50, 20)).toBe(circlePoints("a", 11, 0, 0, 50, 20)); // same boil bucket (9..11)
    expect(circlePoints("a", 10, 0, 0, 50, 20)).not.toBe(circlePoints("a", 13, 0, 0, 50, 20));
    expect(circlePoints("a", 10, 0, 0, 50, 20, 5)).toBe(circlePoints("a", 14, 0, 0, 50, 20, 5));
    expect(underlinePoints("u", 0, 0, 0, 100)).not.toBe(underlinePoints("u", 3, 0, 0, 100));
    expect(arrowPoints("r", 0, 0, 0, 100, 100)).not.toEqual(arrowPoints("r", 6, 0, 0, 100, 100));
    expect(arrowPoints("r", 0, 0, 0, 100, 100)).toEqual(arrowPoints("r", 0, 0, 0, 100, 100));
  });
});

describe("continuity and frame 0", () => {
  it("zoomThrough is continuous at its start frame", () => {
    const cam = { x: 100, y: 50, scale: 1.5 };
    const a = zoomThrough(40, [40, 80], cam, { x: 900, y: 700 }, 70);
    expect(a).toEqual(cam);
    const b = zoomThrough(41, [40, 80], cam, { x: 900, y: 700 }, 70);
    expect(Math.abs(b.scale - a.scale)).toBeLessThan(0.05);
    expect(Math.abs(b.x - a.x)).toBeLessThan(100);
  });
  it("cameraAt at frame 0 is finite and still", () => {
    const keys: CameraKey[] = [{ f: 0, x: 10, y: 20, scale: 1 }, { f: 30, x: 500, y: 300, scale: 2 }];
    const c = cameraAt(0, keys);
    expect(Object.values(c).every(Number.isFinite)).toBe(true);
    expect(c).toMatchObject({ x: 10, y: 20, scale: 1, blur: 0 });
    expect(c.rx).toBeCloseTo(0);
  });
});
