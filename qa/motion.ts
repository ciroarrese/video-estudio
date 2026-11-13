import { rectShift } from './geometry';
import type { PageData, Rect } from './types';

/** Distinct element keys of the covers found in `data` (their motion has to be looked up in the neighbours). */
export const coverKeys = (data: PageData): string[] => [...new Set(data.runs.flatMap((r) => (r.cover ? [r.cover.key] : [])))];

/**
 * Sets `run.motion` / `run.cover.motion`: the largest edge displacement (px) of the same element (same key)
 * between `data` and each neighbour frame. Elements missing in a neighbour count as 0: static defects stay errors.
 */
export function applyMotion(data: PageData, neighbours: PageData[]): void {
  const lookups = neighbours.map((n) => {
    const m = new Map<string, Rect>();
    for (const r of n.runs) m.set(r.key, r.rect);
    return { runs: m, elems: n.elems };
  });
  for (const r of data.runs) {
    let mv = 0;
    for (const l of lookups) {
      const o = l.runs.get(r.key);
      if (o) mv = Math.max(mv, rectShift(r.rect, o));
      if (r.cover) {
        const e = l.elems[r.cover.key];
        if (e) r.cover.motion = Math.max(r.cover.motion ?? 0, rectShift(r.cover.rect, e));
      }
    }
    r.motion = mv;
  }
}
