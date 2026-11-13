import { describe, ignored, intersect, protrusion } from '../geometry';
import type { Finding, Rule } from '../types';

/** Text under a camera/zoom transform is skipped (the camera decides where it ends up). Visible text inside the frame but outside the safe margins (warning). Text already reported as offscreen is skipped. */
export const safeAreaRule: Rule = {
  id: 'safe-area',
  description: 'Texto fuera del area segura (margen por lado)',
  check({ frame, width, height, runs, thresholds }) {
    const t = thresholds['safe-area'];
    const mx = width * t.margin;
    const my = height * t.margin;
    const safe = { x: mx, y: my, w: width - 2 * mx, h: height - 2 * my };
    const frameBox = { x: 0, y: 0, w: width, h: height };
    const out: Finding[] = [];
    const seen = new Set<number>();
    for (const r of runs) {
      if (r.opacity < t.minOpacity || r.transformed || ignored(r, 'safe-area') || seen.has(r.elId)) continue;
      for (const line of r.lines) {
        if (!intersect(line, frameBox)) continue;
        if (protrusion(line, frameBox) > 1) continue; // that is the offscreen rule's job
        const px = protrusion(line, safe);
        if (px <= 1) continue;
        seen.add(r.elId);
        out.push({
          rule: 'safe-area', severity: 'warn', frame,
          message: `texto fuera del area segura (${Math.round(t.margin * 100)}% por lado), invade ${Math.round(px)}px`,
          element: describe(r), data: { protrusionPx: Math.round(px) },
        });
        break;
      }
    }
    return out;
  },
};
