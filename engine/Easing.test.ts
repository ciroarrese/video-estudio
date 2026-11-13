import { describe, expect, it } from 'vitest';
import { Easing, bezier } from './Easing';

describe('Easing', () => {
  it('has fixed endpoints', () => {
    for (const f of [Easing.linear, Easing.cubicIn, Easing.cubicOut, Easing.cubicInOut, Easing.out, Easing.inOut, bezier(0.25, 0.1, 0.25, 1)]) {
      expect(f(0)).toBeCloseTo(0, 6);
      expect(f(1)).toBeCloseTo(1, 6);
    }
  });
  it('is monotonic for presets', () => {
    for (const f of [Easing.out, Easing.inOut, bezier(0.42, 0, 0.58, 1)]) {
      let prev = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const v = f(i / 100);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });
  it('bezier(0,0,1,1) is linear', () => {
    const f = bezier(0, 0, 1, 1);
    for (const t of [0.1, 0.3, 0.7, 0.9]) expect(f(t)).toBeCloseTo(t, 5);
  });
  it('matches the CSS ease-in-out value at 0.5', () => {
    expect(bezier(0.42, 0, 0.58, 1)(0.5)).toBeCloseTo(0.5, 5);
    expect(Easing.inOut(0.5)).toBeCloseTo(0.5, 5);
  });
  it('out is front-loaded, cubic variants behave', () => {
    expect(Easing.out(0.2)).toBeGreaterThan(0.5);
    expect(Easing.cubicIn(0.5)).toBe(0.125);
    expect(Easing.cubicOut(0.5)).toBe(0.875);
    expect(Easing.cubicInOut(0.5)).toBe(0.5);
  });
  it('rejects x control points outside [0,1]', () => {
    expect(() => bezier(1.5, 0, 0.5, 1)).toThrow();
  });
});

describe('back / lands', () => {
  it('overshoots 1 and settles', () => {
    const b = Easing.back();
    expect(b(0)).toBe(0);
    expect(b(1)).toBe(1);
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => b(i / 100)))).toBeGreaterThan(1.05);
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => Easing.lands(i / 100)))).toBeGreaterThan(1.05);
    expect(Easing.lands(1)).toBe(1);
  });
  it('keeps out and inOut unchanged', () => {
    expect(Easing.out(0.2)).toBeGreaterThan(0.5);
    expect(Easing.inOut(0.5)).toBeCloseTo(0.5, 5);
  });
});
