import { describe, expect, it } from 'vitest';
import { area, hiddenFraction, ink, intersect, isHuge, overlapRatio, protrusion, unionRect } from './geometry';

const r = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe('geometry', () => {
  it('intersects rects and returns null when they only touch', () => {
    expect(intersect(r(0, 0, 10, 10), r(5, 5, 10, 10))).toEqual(r(5, 5, 5, 5));
    expect(intersect(r(0, 0, 10, 10), r(10, 0, 5, 5))).toBeNull();
    expect(intersect(r(0, 0, 10, 10), r(20, 20, 5, 5))).toBeNull();
  });

  it('overlap ratio is relative to the smaller rect', () => {
    expect(overlapRatio(r(0, 0, 100, 100), r(0, 0, 10, 10))).toBe(1);
    expect(overlapRatio(r(0, 0, 10, 10), r(5, 0, 10, 10))).toBeCloseTo(0.5);
    expect(overlapRatio(r(0, 0, 10, 10), r(50, 50, 10, 10))).toBe(0);
    expect(overlapRatio(r(0, 0, 0, 10), r(0, 0, 10, 10))).toBe(0);
  });

  it('hidden fraction honours the clipped axes', () => {
    const box = r(0, 0, 100, 100);
    expect(hiddenFraction(r(50, 10, 100, 10), box)).toBeCloseTo(0.5);
    expect(hiddenFraction(r(50, 10, 100, 10), box, { x: false, y: true })).toBe(0);
    expect(hiddenFraction(r(200, 10, 10, 10), box)).toBe(1);
    expect(hiddenFraction(r(10, 10, 10, 10), box)).toBe(0);
  });

  it('protrusion, union, ink and huge', () => {
    expect(protrusion(r(90, 10, 30, 10), r(0, 0, 100, 100))).toBe(20);
    expect(protrusion(r(10, 10, 30, 10), r(0, 0, 100, 100))).toBe(0);
    expect(unionRect([r(0, 0, 10, 10), r(20, 5, 10, 10)])).toEqual(r(0, 0, 30, 15));
    expect(ink(r(0, 0, 100, 40), 0.5)).toEqual(r(0, 10, 100, 20));
    expect(area(ink(r(0, 0, 100, 40), 0.75))).toBe(3000);
    expect(isHuge(r(0, 0, 5000, 10), 1920, 1080, 2)).toBe(true);
    expect(isHuge(r(0, 0, 1000, 10), 1920, 1080, 2)).toBe(false);
  });
});
