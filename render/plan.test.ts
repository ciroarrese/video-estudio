import { describe, expect, it } from 'vitest';
import { digestFiles, evenFrames, frameFile, framePattern, planSegments, planShards, segmentKey, stableStringify } from './plan';

describe('planShards', () => {
  it('splits contiguously and balanced', () => {
    expect(planShards(10, 3)).toEqual([{ start: 0, end: 4 }, { start: 4, end: 7 }, { start: 7, end: 10 }]);
  });
  it('never makes empty shards', () => {
    expect(planShards(2, 6)).toEqual([{ start: 0, end: 1 }, { start: 1, end: 2 }]);
    expect(planShards(0, 4)).toEqual([]);
  });
  it('covers everything exactly once', () => {
    for (const [t, n] of [[90, 4], [91, 6], [7, 7], [1, 3]] as const) {
      const s = planShards(t, n);
      expect(s[0]!.start).toBe(0);
      expect(s.at(-1)!.end).toBe(t);
      s.slice(1).forEach((x, i) => expect(x.start).toBe(s[i]!.end));
    }
  });
  it('rejects bad input', () => {
    expect(() => planShards(5, 0)).toThrow();
    expect(() => planShards(-1, 2)).toThrow();
  });
});

describe('planSegments', () => {
  it('aligns to multiples of the size', () => {
    expect(planSegments(0, 299, 150)).toEqual([{ start: 0, end: 149 }, { start: 150, end: 299 }]);
    expect(planSegments(0, 89, 150)).toEqual([{ start: 0, end: 89 }]);
  });
  it('clips a partial range to aligned segments', () => {
    expect(planSegments(40, 79, 40)).toEqual([{ start: 40, end: 79 }]);
    expect(planSegments(30, 100, 50)).toEqual([{ start: 30, end: 49 }, { start: 50, end: 99 }, { start: 100, end: 100 }]);
  });
  it('rejects bad input', () => {
    expect(() => planSegments(5, 4, 10)).toThrow();
    expect(() => planSegments(0, 4, 0)).toThrow();
  });
});

describe('segmentKey', () => {
  const base = { bundleHash: 'abc', videoId: 'v', props: { a: 1, b: { c: 2, d: 3 } }, start: 0, end: 149, scale: 1, crf: 18 };
  it('is stable and independent of prop key order', () => {
    expect(segmentKey(base)).toBe(segmentKey({ ...base }));
    expect(segmentKey({ ...base, props: { b: { d: 3, c: 2 }, a: 1 } })).toBe(segmentKey(base));
    expect(segmentKey(base)).toMatch(/^[0-9a-f]{20}$/);
  });
  it('changes with every input', () => {
    const k = segmentKey(base);
    for (const patch of [{ bundleHash: 'x' }, { videoId: 'w' }, { props: { a: 2 } }, { start: 1 }, { end: 150 }, { scale: 2 }, { crf: 20 }, { env: { ffmpeg: 'x' } }]) {
      expect(segmentKey({ ...base, ...patch })).not.toBe(k);
    }
  });
  it('covers every env component (assets digest, tool versions, fps, size, encoder...)', () => {
    const env = { ffmpeg: 'a', chromium: '1', chromiumArgs: '', assets: 'd', fps: 30, width: 1920, height: 1080, encoder: { preset: 'medium', bframes: 2 } };
    const k = segmentKey({ ...base, env });
    expect(segmentKey({ ...base, env: { ...env } })).toBe(k);
    for (const patch of [{ ffmpeg: 'b' }, { chromium: '2' }, { chromiumArgs: '--x' }, { assets: 'e' }, { fps: 60 }, { width: 1280 }, { height: 720 }, { encoder: { preset: 'slow', bframes: 2 } }]) {
      expect(segmentKey({ ...base, env: { ...env, ...patch } })).not.toBe(k);
    }
  });
  it('stableStringify sorts keys and ignores undefined', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}');
  });
});

describe('evenFrames', () => {
  it('spreads frames including first and last', () => {
    const f = evenFrames(90, 12);
    expect(f).toHaveLength(12);
    expect(f[0]).toBe(0);
    expect(f.at(-1)).toBe(89);
  });
  it('dedupes short videos', () => {
    expect(evenFrames(3, 12)).toEqual([0, 1, 2]);
    expect(evenFrames(1, 12)).toEqual([0]);
  });
});

describe('segment grid sharing', () => {
  it('a partial range shares every fully covered segment with the full render', () => {
    const full = planSegments(0, 449, 150);
    const part = planSegments(100, 400, 150);
    expect(part).toEqual([{ start: 100, end: 149 }, { start: 150, end: 299 }, { start: 300, end: 400 }]);
    // only the interior (whole) segment is shared; the edges are partial and get their own keys
    expect(part.filter((p) => full.some((f) => f.start === p.start && f.end === p.end))).toEqual([{ start: 150, end: 299 }]);
  });
});

describe('digestFiles', () => {
  const e = [{ path: 'a/x.wav', size: 10, mtimeMs: 1000 }, { path: 'b.wav', size: 5, mtimeMs: 2000 }];
  it('is order independent and sensitive to path, size and mtime', () => {
    const d = digestFiles(e);
    expect(digestFiles([...e].reverse())).toBe(d);
    expect(digestFiles([{ ...e[0]!, size: 11 }, e[1]!])).not.toBe(d);
    expect(digestFiles([{ ...e[0]!, mtimeMs: 1001 }, e[1]!])).not.toBe(d);
    expect(digestFiles([{ ...e[0]!, path: 'a/y.wav' }, e[1]!])).not.toBe(d);
    expect(digestFiles(e.slice(1))).not.toBe(d);
  });
});

describe('frame naming for ffmpeg image2', () => {
  it('uses a relative pattern with exactly one printf directive, whatever the directory is', () => {
    expect(framePattern('png')).toBe('%06d.png');
    expect(framePattern('jpg').match(/%/g)).toHaveLength(1);
    expect(framePattern('png')).not.toContain('/');
  });
  it('file names match the pattern', () => {
    expect(frameFile(7, 'png')).toBe('000007.png');
    expect(frameFile(123456, 'jpg')).toBe('123456.jpg');
  });
});
