import { describe, ignored, ink, isHuge, overlapRatio } from '../geometry';
import type { Finding, Rule } from '../types';

/** Two visible text runs of different, unrelated elements whose line boxes intersect more than `ratio` of the smaller. */
export const overlapRule: Rule = {
  id: 'overlap',
  description: 'Dos textos de elementos distintos que se pisan',
  check({ frame, width, height, runs, thresholds }) {
    const t = thresholds.overlap;
    const live = runs.filter((r) => r.opacity >= t.minOpacity && !ignored(r, 'overlap') && !isHuge(r.rect, width, height, t.maxFrames));
    const out: Finding[] = [];
    const reported = new Set<string>();
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i]!;
        const b = live[j]!;
        if (a.decor && b.decor) continue; // adorno contra adorno: no se juzga; contra texto normal, sí
        if (a.elId === b.elId || a.chain.includes(b.elId) || b.chain.includes(a.elId)) continue;
        // quick reject on the union boxes
        if (overlapRatio(a.rect, b.rect) === 0) continue;
        let best = 0;
        for (const la of a.lines) for (const lb of b.lines) best = Math.max(best, overlapRatio(ink(la, t.inkHeight), ink(lb, t.inkHeight)));
        if (best <= t.ratio) continue;
        const key = `${Math.min(a.elId, b.elId)}:${Math.max(a.elId, b.elId)}`;
        if (reported.has(key)) continue;
        reported.add(key);
        out.push({
          rule: 'overlap', severity: Math.max(a.motion ?? 0, b.motion ?? 0) > thresholds.motion.crossPx ? 'info' : 'error', frame,
          message: `dos textos se pisan (${Math.round(best * 100)}% del menor)${Math.max(a.motion ?? 0, b.motion ?? 0) > thresholds.motion.crossPx ? '; uno de los dos se mueve entre cuadros: se cruzan en una transicion' : ''}`,
          element: describe(a), other: describe(b), data: { ratio: Math.round(best * 100) / 100 },
        });
      }
    }
    return out;
  },
};
