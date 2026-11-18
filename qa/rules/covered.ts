import { area, intersect } from '../geometry';
import { describe, ignored, pathOfKey, roundRect } from '../geometry';
import type { Finding, Rule } from '../types';
import { edgeCut } from '../world';

/**
 * Text under an opaque, unrelated element (decided in the page with elementsFromPoint at 5 points per line, so a cover over
 * only one side of a line is caught; a background image or gradient counts as opaque).
 * Skipped: text that is nearly invisible. One finding per coverer (not per text run).
 * Severity: `info` when the text or the coverer is in motion (transition). Static is an `error`, hidden entirely or not.
 * A coverer that spans >= `maxCoverFraction` of the frame (scene wash, end card) is reported too, as `warn` when static and fully opaque (`info` mid-fade or moving; it is
 * usually a scene that should be unmounted, but also what a transition leaves for a frame): the other rules skip that text, this one says so.
 * Con el mundo acercado (`data-qa-world`), un texto de la interfaz que el borde del cuadro corta y además está tapado baja a `info` (lo que deriva del corte). El objetivo
 * (`data-qa-target`) tapado es error aunque la cámara se mueva, salvo que todavía viaje hacia él (no asentada). Lo que tapa una capa `data-qa-overlay` no llega acá (se descarta en la recolección).
 */
const FULL_OPACITY = 0.99;

export const coveredRule: Rule = {
  id: 'covered',
  description: 'Texto tapado por otro elemento opaco',
  check({ frame, width, height, runs, thresholds }) {
    const t = thresholds.covered;
    const px = thresholds.motion.crossPx;
    const byCover = new Map<number, typeof runs>();
    for (const r of runs) {
      const c = r.cover;
      if (!c || r.opacity < t.minOpacity || ignored(r, 'covered') || ignored(c, 'covered')) continue;
      (byCover.get(c.id) ?? byCover.set(c.id, []).get(c.id)!).push(r);
    }
    const out: Finding[] = [];
    for (const list of byCover.values()) {
      const r = list[0]!;
      const c = r.cover!;
      const target = list.some((x) => x.target);
      const settled = list.some((x) => x.world?.settled);
      const moving = !(target && settled) && ((c.motion ?? 0) > px || list.some((x) => (x.motion ?? 0) > px));
      const cut = !target && list.every((x) => edgeCut(x, width, height, thresholds.offscreen.tolerancePx));
      const fullFrame = area(c.rect) >= t.maxCoverFraction * width * height;
      const hiddenFully = list.every((x) => {
        const i = intersect(x.rect, c.rect);
        return i !== null && area(i) >= t.hiddenFully * area(x.rect);
      });
      // una capa de cuadro completo a medio fundido (lavado de escena) es transicion: info; opaca del todo y quieta: aviso
      const settling = fullFrame && (c.opacity ?? 1) < FULL_OPACITY;
      const severity = moving || settling || cut ? 'info' : fullFrame ? 'warn' : 'error';
      const pct = c.frac !== undefined && c.frac < 1 ? ` (${Math.round(c.frac * 100)}% de los puntos medidos)` : '';
      out.push({
        rule: 'covered', severity, frame,
        message: `${fullFrame ? 'texto bajo una capa opaca de cuadro completo' : 'texto tapado por otro elemento opaco'}${pct}${list.length > 1 ? ` (${list.length} textos bajo el mismo elemento)` : ''}${cut ? '; el borde del cuadro corta ese texto con el mundo (data-qa-world) acercado: encuadre, no se juzga' : moving ? '; en movimiento' : settling ? '; la capa esta a medio fundido' : hiddenFully ? '; el texto queda oculto por completo' : ''}`,
        element: describe(r), other: { tag: c.tag, testid: c.testid, text: c.text, rect: roundRect(c.rect), path: pathOfKey(c.key) },
        data: { covered: list.length, ...(target ? { objetivo: true } : {}) },
      });
    }
    return out;
  },
};
