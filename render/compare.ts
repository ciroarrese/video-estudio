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
  /** histogram[d] = cantidad de pixeles cuyo delta maximo por canal es d (0-255). */
  histogram: number[];
};

/**
 * Tolerancia del `--check` (modo no estricto), en tres cotas que se cumplen a la vez:
 * 1. a lo sumo `maxOverPixels` pixeles con delta > `maxDelta` (por defecto 0: un cambio real no pasa);
 * 2. los pixeles con delta > 1 (o sea 2..maxDelta) son a lo sumo `maxRatio` del cuadro (0,1 %);
 * 3. los pixeles con delta 1 (ruido de desenfoques y sombras) son a lo sumo `maxNoiseRatio` del cuadro (20 %).
 */
export type CheckTolerance = { maxDelta: number; maxRatio: number; strict: boolean; maxOverPixels?: number; maxNoiseRatio?: number };
export const DEFAULT_TOLERANCE: Required<CheckTolerance> = { maxDelta: 2, maxRatio: 0.001, strict: false, maxOverPixels: 0, maxNoiseRatio: 0.2 };

export function comparePixels(a: Pixels, b: Pixels): DiffStats {
  const total = a.width * a.height;
  if (a.width !== b.width || a.height !== b.height) {
    return { maxDelta: 255, diffPixels: total, totalPixels: total, ratio: 1, bbox: [0, 0, a.width - 1, a.height - 1], sizeMismatch: true, histogram: [] };
  }
  const histogram = new Array<number>(256).fill(0);
  let maxDelta = 0, diff = 0, x0 = a.width, y0 = a.height, x1 = -1, y1 = -1;
  for (let p = 0; p < total; p++) {
    const o = p * 4;
    let d = 0;
    for (let c = 0; c < 4; c++) {
      const v = Math.abs(a.data[o + c]! - b.data[o + c]!);
      if (v > d) d = v;
    }
    histogram[d]!++;
    if (d === 0) continue;
    diff++;
    if (d > maxDelta) maxDelta = d;
    const x = p % a.width, y = (p / a.width) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { maxDelta, diffPixels: diff, totalPixels: total, ratio: total ? diff / total : 0, bbox: diff ? [x0, y0, x1, y1] : null, histogram };
}

export const comparePngs = (a: Uint8Array, b: Uint8Array): DiffStats => comparePixels(decodePng(a), decodePng(b));

/** Cantidad de pixeles con delta maximo por canal dentro de [lo, hi]. */
const countBetween = (h: number[], lo: number, hi: number): number => {
  let n = 0;
  for (let d = lo; d <= Math.min(hi, 255); d++) n += h[d] ?? 0;
  return n;
};

/** Pasa si se cumplen las tres cotas de `CheckTolerance`. Estricto: ninguna diferencia. */
export function withinTolerance(s: DiffStats, t: CheckTolerance = DEFAULT_TOLERANCE): boolean {
  if (s.sizeMismatch) return false;
  if (t.strict) return s.diffPixels === 0;
  const maxOver = t.maxOverPixels ?? DEFAULT_TOLERANCE.maxOverPixels;
  const maxNoise = t.maxNoiseRatio ?? DEFAULT_TOLERANCE.maxNoiseRatio;
  if (!s.totalPixels) return true;
  const over = countBetween(s.histogram, t.maxDelta + 1, 255);
  const mid = countBetween(s.histogram, 2, t.maxDelta);
  const noise = countBetween(s.histogram, 1, Math.min(1, t.maxDelta));
  return over <= maxOver && mid / s.totalPixels <= t.maxRatio && noise / s.totalPixels <= maxNoise;
}

export const formatDiff = (s: DiffStats): string =>
  s.diffPixels === 0
    ? 'identico'
    : `max delta ${s.maxDelta}, ${s.diffPixels} px (${(s.ratio * 100).toFixed(4)}%), bbox ${s.bbox!.join(',')}${s.sizeMismatch ? ' (tamanos distintos)' : ''}`;
