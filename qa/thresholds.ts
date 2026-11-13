import type { Thresholds } from './types';

export const DEFAULT_THRESHOLDS: Thresholds = {
  clip: { tolerancePx: 1.5, minHiddenFraction: 0.02, minOpacity: 0.05, maxFrames: 2 },
  offscreen: { tolerancePx: 1, minOpacity: 0.05, maxFrames: 2, slipPct: 15, sliverPx: 6, cameraPx: 1 },
  'safe-area': { margin: 0.03, minOpacity: 0.05 },
  overlap: { ratio: 0.2, minOpacity: 0.3, inkHeight: 0.75, maxFrames: 2 },
  'min-size': { minPx1080: 18, minOpacity: 0.35, tolerancePx: 0.5 },
  contrast: { error: 3, warn: 4.5, largePx1080: 24, minOpacity: 0.35 },
  covered: { minOpacity: 0.2, maxCoverFraction: 0.9, hiddenFully: 0.97 },
  motion: { px: 12, crossPx: 4 },
};

export type ThresholdOverrides = { [K in keyof Thresholds]?: Partial<Thresholds[K]> };

export function mergeThresholds(over: ThresholdOverrides = {}): Thresholds {
  const out = structuredClone(DEFAULT_THRESHOLDS) as Record<string, Record<string, number>>;
  for (const [rule, vals] of Object.entries(over)) {
    if (!out[rule]) throw new Error(`Regla desconocida en umbrales: ${rule}`);
    for (const [k, v] of Object.entries(vals ?? {})) {
      if (!(k in out[rule]!)) throw new Error(`Umbral desconocido: ${rule}.${k}`);
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Umbral invalido: ${rule}.${k}`);
      out[rule]![k] = v;
    }
  }
  return out as unknown as Thresholds;
}

/** Parses "overlap.ratio=0.3" style assignments (CLI --set). */
export function parseOverrides(assignments: string[]): ThresholdOverrides {
  const out: Record<string, Record<string, number>> = {};
  for (const a of assignments) {
    const m = /^([a-z-]+)\.([A-Za-z0-9]+)=(-?\d*\.?\d+)$/.exec(a);
    if (!m) throw new Error(`--set invalido: "${a}" (usa regla.umbral=valor, p. ej. overlap.ratio=0.3)`);
    (out[m[1]!] ??= {})[m[2]!] = Number(m[3]);
  }
  return out as ThresholdOverrides;
}
