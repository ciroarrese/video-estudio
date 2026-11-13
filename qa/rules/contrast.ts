import { contrastRatio } from '../../themes/contrast';
import { describe, ignored } from '../geometry';
import type { Finding, Rule, Severity, Thresholds } from '../types';

/** Pure classification of a contrast ratio: error below `error`, warning below `warn` for small text. */
export function classifyContrast(ratio: number, large: boolean, t: Thresholds['contrast']): Severity | null {
  if (ratio < t.error) return 'error';
  if (ratio < t.warn && !large) return 'warn';
  return null;
}

/** WCAG "large text": >= 24px, or >= 18.66px bold (at 1080p, scaled with the frame height). */
export const isLargeText = (screenPx: number, bold: boolean, height: number, t: Thresholds['contrast']) => {
  const k = height / 1080;
  return screenPx >= t.largePx1080 * k || (bold && screenPx >= 18.66 * k);
};

export const toRgb = (c: { r: number; g: number; b: number }) => `rgb(${c.r},${c.g},${c.b})`;

/** Text colour (times the element opacity) against the background sampled with the text hidden. */
export const contrastRule: Rule = {
  id: 'contrast',
  description: 'Contraste insuficiente entre el texto y el fondo real',
  check({ frame, height, runs, thresholds }) {
    const t = thresholds.contrast;
    const out: Finding[] = [];
    const seen = new Set<number>();
    for (const r of runs) {
      if (!r.bg || r.transparentFill || r.opacity < 0.05 || ignored(r, 'contrast') || seen.has(r.elId)) continue;
      const m = /rgba?\(([^)]+)\)/.exec(r.color);
      if (!m) continue;
      const [cr, cg, cb, ca = '1'] = m[1]!.split(/[,\s/]+/).filter(Boolean);
      // A settled frame shows the text at full opacity: judge fading text (>= minOpacity) by its own colour; only very faint text is judged as drawn.
      const alpha = Math.min(1, Number(ca) * (r.opacity < t.minOpacity ? r.opacity : 1));
      let ratio: number;
      try {
        ratio = contrastRatio(`rgba(${cr},${cg},${cb},${alpha})`, toRgb(r.bg));
      } catch {
        continue;
      }
      let sev: Severity | null = classifyContrast(ratio, isLargeText(r.screenPx, r.bold, height, t), t);
      if (!sev) continue;
      if (r.opacity < t.minOpacity) sev = 'info'; // very faint: decorative or mid-fade
      seen.add(r.elId);
      out.push({
        rule: 'contrast', severity: sev, frame,
        message: `contraste ${ratio.toFixed(2)}:1 (${ratio < t.error ? `minimo ${t.error}` : `recomendado ${t.warn}`}:1)${r.opacity < t.minOpacity ? ` con opacidad ${r.opacity.toFixed(2)} (muy tenue)` : ''} ${r.color} sobre ${toRgb(r.bg)}`,
        element: describe(r), data: { ratio: Math.round(ratio * 100) / 100 },
      });
    }
    return out;
  },
};
