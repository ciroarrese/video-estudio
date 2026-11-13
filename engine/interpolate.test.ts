import { describe, expect, it } from 'vitest';
import { interpolate } from './interpolate';
import { Easing } from './Easing';

describe('interpolate', () => {
  it('interpolates linearly between two keyframes', () => {
    expect(interpolate(5, [0, 10], [0, 100])).toBe(50);
  });
  it('handles multiple segments', () => {
    const i = [0, 10, 30];
    const o = [0, 100, 0];
    expect(interpolate(5, i, o)).toBe(50);
    expect(interpolate(10, i, o)).toBe(100);
    expect(interpolate(20, i, o)).toBe(50);
  });
  it('clamps by default', () => {
    expect(interpolate(-5, [0, 10], [0, 100])).toBe(0);
    expect(interpolate(50, [0, 10], [0, 100])).toBe(100);
  });
  it('extrapolates with clamp: false', () => {
    expect(interpolate(20, [0, 10], [0, 100], { clamp: false })).toBe(200);
    expect(interpolate(-10, [0, 10], [0, 100], { clamp: false })).toBe(-100);
  });
  it('applies easing per segment', () => {
    const e = (t: number) => t * t;
    // segment 1: t=0.5 -> 0.25 of 0..100; segment 2: t=0.5 -> 0.25 of 100..0
    expect(interpolate(5, [0, 10, 20], [0, 100, 0], { easing: e })).toBe(25);
    expect(interpolate(15, [0, 10, 20], [0, 100, 0], { easing: e })).toBe(75);
  });
  it('works with Easing.out', () => {
    const v = interpolate(5, [0, 10], [0, 1], { easing: Easing.out });
    expect(v).toBeGreaterThan(0.5);
    expect(v).toBeLessThan(1);
  });
  it('throws on a non-finite frame', () => {
    expect(() => interpolate(NaN, [0, 1], [0, 1])).toThrow(/finite/);
    expect(() => interpolate(Infinity, [0, 1], [0, 1])).toThrow(/finite/);
  });
  it('validates input', () => {
    expect(() => interpolate(0, [0, 1], [0])).toThrow(/same length/);
    expect(() => interpolate(0, [0], [0])).toThrow(/at least 2/);
    expect(() => interpolate(0, [0, 5, 5], [0, 1, 2])).toThrow(/strictly increasing/);
    expect(() => interpolate(0, [10, 0], [0, 1])).toThrow(/strictly increasing/);
    expect(() => interpolate(0, [0, NaN], [0, 1])).toThrow(/finite/);
  });
});

describe('interpolate with overshooting easing', () => {
  it('passes eased values above 1 through to the output', async () => {
    const { Easing } = await import('./Easing');
    const v = interpolate(30, [0, 100], [0, 200], { easing: Easing.lands });
    expect(v).toBeGreaterThan(200 * 0.9);
    const peak = Math.max(...Array.from({ length: 100 }, (_, f) => interpolate(f, [0, 100], [0, 200], { easing: Easing.lands })));
    expect(peak).toBeGreaterThan(200);
    expect(interpolate(150, [0, 100], [0, 200], { easing: Easing.lands })).toBe(200);
  });
});
