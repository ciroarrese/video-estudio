import { area, intersect } from '../geometry';
import { describe, ignored, pathOfKey, roundRect } from '../geometry';
import type { Finding, Rule } from '../types';

/**
 * Text whose centre is under an opaque, unrelated element (decided in the page with elementsFromPoint).
 * Skipped: a coverer that spans >= `maxCoverFraction` of the frame (scene wash/fade) and text that is nearly invisible.
 * One finding per coverer (not per text run); `info` when the text or the coverer is in motion (transition), or when the
 * text is hidden entirely (>= `hiddenFully` of its box under the coverer: it sits on a lower layer on purpose; a partly covered text is the defect).
 */
export const coveredRule: Rule = {
  id: 'covered',
  description: 'Texto tapado por otro elemento opaco',
  check({ frame, width, height, runs, thresholds }) {
    const t = thresholds.covered;
    const px = thresholds.motion.px;
    const byCover = new Map<number, typeof runs>();
    for (const r of runs) {
      const c = r.cover;
      if (!c || r.opacity < t.minOpacity || ignored(r, 'covered') || ignored(c, 'covered')) continue;
      if (area(c.rect) >= t.maxCoverFraction * width * height) continue;
      (byCover.get(c.id) ?? byCover.set(c.id, []).get(c.id)!).push(r);
    }
    const out: Finding[] = [];
    for (const list of byCover.values()) {
      const r = list[0]!;
      const c = r.cover!;
      const moving = (c.motion ?? 0) > px || list.some((x) => (x.motion ?? 0) > px);
      const hiddenFully = list.every((x) => {
        const i = intersect(x.rect, c.rect);
        return i !== null && area(i) >= t.hiddenFully * area(x.rect);
      });
      out.push({
        rule: 'covered', severity: moving || hiddenFully ? 'info' : 'error', frame,
        message: `el centro del texto esta tapado por otro elemento opaco${list.length > 1 ? ` (${list.length} textos bajo el mismo elemento)` : ''}${moving ? '; en movimiento' : hiddenFully ? '; el texto queda oculto por completo (capa inferior)' : ''}`,
        element: describe(r), other: { tag: c.tag, testid: c.testid, text: c.text, rect: roundRect(c.rect), path: pathOfKey(c.key) },
        data: { covered: list.length },
      });
    }
    return out;
  },
};
