import { decodePng, type Pixels } from './png';

export type DiffStats = {
  /** Max per-channel absolute difference (0-255). */
  maxDelta: number;
  /** Pixels where any channel differs. */
  diffPixels: number;
  totalPixels: number;
  /** diffPixels / totalPixels, 0-1. */
  ratio: number;
  /** [x0, y0, x1, y1] inclusive, or null when identical. */
  bbox: [number, number, number, number] | null;
  sizeMismatch?: boolean;
};

export type CheckTolerance = { maxDelta: number; maxRatio: number; strict: boolean };
export const DEFAULT_TOLERANCE: CheckTolerance = { maxDelta: 2, maxRatio: 0.001, strict: false };

export function comparePixels(a: Pixels, b: Pixels): DiffStats {
  const total = a.width * a.height;
  if (a.width !== b.width || a.height !== b.height) {
    return { maxDelta: 255, diffPixels: total, totalPixels: total, ratio: 1, bbox: [0, 0, a.width - 1, a.height - 1], sizeMismatch: true };
  }
  let maxDelta = 0, diff = 0, x0 = a.width, y0 = a.height, x1 = -1, y1 = -1;
  for (let p = 0; p < total; p++) {
    const o = p * 4;
    let d = 0;
    for (let c = 0; c < 4; c++) {
      const v = Math.abs(a.data[o + c]! - b.data[o + c]!);
      if (v > d) d = v;
    }
    if (d === 0) continue;
    diff++;
    if (d > maxDelta) maxDelta = d;
    const x = p % a.width, y = (p / a.width) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { maxDelta, diffPixels: diff, totalPixels: total, ratio: total ? diff / total : 0, bbox: diff ? [x0, y0, x1, y1] : null };
}

export const comparePngs = (a: Uint8Array, b: Uint8Array): DiffStats => comparePixels(decodePng(a), decodePng(b));

/** Pass when max delta <= maxDelta AND differing pixels <= maxRatio of the frame (strict: no difference at all). */
export function withinTolerance(s: DiffStats, t: CheckTolerance = DEFAULT_TOLERANCE): boolean {
  if (s.sizeMismatch) return false;
  if (t.strict) return s.diffPixels === 0;
  return s.maxDelta <= t.maxDelta && s.ratio <= t.maxRatio;
}

export const formatDiff = (s: DiffStats): string =>
  s.diffPixels === 0
    ? 'identico'
    : `max delta ${s.maxDelta}, ${s.diffPixels} px (${(s.ratio * 100).toFixed(4)}%), bbox ${s.bbox!.join(',')}${s.sizeMismatch ? ' (tamanos distintos)' : ''}`;
