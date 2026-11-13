import { describe, hiddenFraction, ignored, intersect, isHuge, protrusion } from '../geometry';
import type { Finding, Rule } from '../types';

/** Text partly outside the frame (error; under a camera/zoom transform only a warning when more than `slipPct`% is cut: a big crop is a pan, a sliver is a framing slip). Fully outside, huge or nearly transparent text is exempt. */
export const offscreenRule: Rule = {
  id: 'offscreen',
  description: 'Texto visible que se sale parcialmente del cuadro',
  check({ frame, width, height, runs, thresholds }) {
    const t = thresholds.offscreen;
    const box = { x: 0, y: 0, w: width, h: height };
    const out: Finding[] = [];
    const seen = new Set<number>();
    for (const r of runs) {
      if (r.opacity < t.minOpacity || ignored(r, 'offscreen') || seen.has(r.elId) || isHuge(r.rect, width, height, t.maxFrames)) continue;
      for (const line of r.lines) {
        if (!intersect(line, box)) continue; // fully outside: leaving on purpose
        const px = protrusion(line, box);
        if (px <= t.tolerancePx) continue;
        seen.add(r.elId);
        const pct = Math.round(hiddenFraction(line, box) * 100);
        out.push({
          rule: 'offscreen', severity: (r.motion ?? 0) > thresholds.motion.px ? 'info' : r.transformed && pct > t.slipPct ? 'warn' : 'error', frame,
          message: `texto parcialmente fuera del cuadro (${pct}% de una linea, sobresale ${Math.round(px)}px)${(r.motion ?? 0) > thresholds.motion.px ? '; el texto esta en movimiento' : r.transformed && pct > t.slipPct ? '; esta bajo un zoom/camara: aviso, no error' : ''}`,
          element: describe(r), data: { hiddenPct: pct, protrusionPx: Math.round(px) },
        });
        break;
      }
    }
    return out;
  },
};
