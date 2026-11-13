import { describe, expect, it } from 'vitest';
import { applyMotion, coverKeys } from './motion';
import { rectShift } from './geometry';
import type { PageData, TextRun } from './types';

const run = (key: string, x: number, cover: TextRun['cover'] = null) =>
  ({ key, rect: { x, y: 0, w: 100, h: 20 }, cover, motion: undefined }) as unknown as TextRun;
const page = (runs: TextRun[], elems: PageData['elems'] = {}): PageData => ({ frame: 0, width: 1, height: 1, runs, elems });

describe('motion', () => {
  it('rectShift is the largest edge displacement', () => {
    expect(rectShift({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 })).toBe(5);
    expect(rectShift({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 30, h: 10 })).toBe(20);
  });
  it('measures the largest shift over the neighbours; unmatched elements stay at 0', () => {
    const cover = { id: 1, key: 'c', tag: 'div', testid: null, text: '', rect: { x: 0, y: 0, w: 50, h: 50 }, ignore: [] };
    const cur = page([run('a', 100, cover), run('b', 0)]);
    expect(coverKeys(cur)).toEqual(['c']);
    applyMotion(cur, [
      page([run('a', 130)], { c: { x: 40, y: 0, w: 50, h: 50 } }),
      page([run('a', 105)]),
    ]);
    expect(cur.runs[0]!.motion).toBe(30);
    expect(cur.runs[0]!.cover!.motion).toBe(40);
    expect(cur.runs[1]!.motion).toBe(0);
  });
});
