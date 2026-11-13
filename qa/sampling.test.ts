import { describe, expect, it } from 'vitest';
import { evenFrames, everyFrames, parseFrameList, sampleFrames } from './sampling';

describe('frame sampling', () => {
  it('parses lists, ranges and steps, deduplicating', () => {
    expect(parseFrameList('0,60,120', 300)).toEqual([0, 60, 120]);
    expect(parseFrameList('10-13', 300)).toEqual([10, 11, 12, 13]);
    expect(parseFrameList('0-90/30,60', 300)).toEqual([0, 30, 60, 90]);
  });
  it('rejects bad specs and out-of-range frames', () => {
    expect(() => parseFrameList('a', 10)).toThrow(/invalidos/);
    expect(() => parseFrameList('5-2', 10)).toThrow(/Rango/);
    expect(() => parseFrameList('10', 10)).toThrow(RangeError);
    expect(() => parseFrameList('', 10)).toThrow();
  });
  it('spreads count frames evenly, first and last included', () => {
    expect(evenFrames(300, 4)).toEqual([0, 100, 199, 299]);
    expect(evenFrames(300, 1)).toEqual([0]);
    expect(evenFrames(5, 24)).toEqual([0, 1, 2, 3, 4]);
    expect(() => evenFrames(10, 0)).toThrow();
  });
  it('every N', () => {
    expect(everyFrames(100, 30)).toEqual([0, 30, 60, 90]);
    expect(() => everyFrames(100, 0)).toThrow();
  });
  it('precedence: explicit frames, then every, then count', () => {
    expect(sampleFrames({ frames: '1,2', every: 5, count: 3 }, 100, 24)).toEqual([1, 2]);
    expect(sampleFrames({ every: 50 }, 100, 24)).toEqual([0, 50]);
    expect(sampleFrames({}, 100, 5)).toHaveLength(5);
    expect(() => sampleFrames({ frames: [200] }, 100, 5)).toThrow(RangeError);
  });
});
