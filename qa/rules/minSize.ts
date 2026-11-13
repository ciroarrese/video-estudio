import { describe, ignored } from '../geometry';
import type { Finding, Rule } from '../types';

/** Text drawn smaller than `minPx1080` (scaled by frame height / 1080), measured on screen: CSS size x transform scale. */
export const minSizeRule: Rule = {
  id: 'min-size',
  description: 'Texto demasiado chico en pantalla',
  check({ frame, height, runs, thresholds }) {
    const t = thresholds['min-size'];
    const min = (t.minPx1080 * height) / 1080;
    const out: Finding[] = [];
    const seen = new Set<number>();
    for (const r of runs) {
      if (r.opacity < 0.05 || ignored(r, 'min-size') || seen.has(r.elId)) continue;
      if (r.screenPx >= min - t.tolerancePx) continue;
      seen.add(r.elId);
      const faint = r.opacity < t.minOpacity;
      const moving = (r.motion ?? 0) > thresholds.motion.px; // shrinking/growing card or text mid-animation
      out.push({
        rule: 'min-size', severity: faint || moving ? 'info' : 'error', frame,
        message: `texto de ${r.screenPx.toFixed(1)}px en pantalla (minimo ${min.toFixed(1)}px)${faint ? `; opacidad ${r.opacity.toFixed(2)} (en fundido o decorativo)` : moving ? '; en movimiento' : ''}`,
        element: describe(r), data: { screenPx: Math.round(r.screenPx * 10) / 10, min: Math.round(min * 10) / 10 },
      });
    }
    return out;
  },
};
