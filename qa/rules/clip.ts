import { describe, hiddenFraction, ignored, intersect, isHuge, protrusion } from '../geometry';
import type { Finding, Rule } from '../types';

/** Text visually cut: own overflow under overflow:hidden/ellipsis, or line boxes partly outside an overflow-hidden ancestor. */
export const clipRule: Rule = {
  id: 'clip',
  description: 'Texto cortado por un contenedor con overflow oculto o por elipsis',
  check({ frame, width, height, runs, thresholds }) {
    const frameBox = { x: 0, y: 0, w: width, h: height };
    const t = thresholds.clip;
    const out: Finding[] = [];
    const seen = new Set<number>();
    for (const r of runs) {
      if (r.opacity < t.minOpacity || ignored(r, 'clip') || seen.has(r.elId) || isHuge(r.rect, width, height, t.maxFrames)) continue;
      let why: string | null = null;
      let data: Finding['data'];
      const o = r.own;
      const clipX = o.ox !== 'visible';
      const clipY = o.oy !== 'visible';
      if (clipX && o.sw > o.cw + t.tolerancePx) {
        why = `el texto (${Math.round(o.sw)}px) es mas ancho que su caja (${Math.round(o.cw)}px)${o.ellipsis ? ' y se recorta con elipsis' : ''}`;
        data = { scrollWidth: o.sw, clientWidth: o.cw };
      } else if (clipY && o.sh > o.ch + t.tolerancePx) {
        why = `el contenido (${Math.round(o.sh)}px) es mas alto que su caja (${Math.round(o.ch)}px)`;
        data = { scrollHeight: o.sh, clientHeight: o.ch };
      } else {
        for (const c of r.clips) {
          // A box at least as big as the frame is just the stage/camera: the frame edge is the offscreen rule's business.
          if (c.rect.x <= 1 && c.rect.y <= 1 && c.rect.x + c.rect.w >= width - 1 && c.rect.y + c.rect.h >= height - 1) continue;
          for (const full of r.lines) {
            const line = intersect(full, frameBox);
            if (!line) continue;
            const hidden = hiddenFraction(line, c.rect, { x: c.ox, y: c.oy });
            // Fully hidden lines are intentional (collapsed / scrolled out); a sliver beyond the tolerance is a defect.
            if (hidden >= 1 - 1e-6 || hidden < t.minHiddenFraction || protrusion(line, c.rect) <= t.tolerancePx) continue;
            why = `${Math.round(hidden * 100)}% de una linea queda fuera de <${c.tag}${c.testid ? ` data-testid="${c.testid}"` : ''}> con overflow oculto`;
            data = { hidden: Math.round(hidden * 100) / 100, container: c.testid ?? c.tag };
            break;
          }
          if (why) break;
        }
      }
      if (why) {
        seen.add(r.elId);
        out.push({ rule: 'clip', severity: 'error', frame, message: why, element: describe(r), ...(data ? { data } : {}) });
      }
    }
    return out;
  },
};
