import { contrastRatio } from '../../themes/contrast';
import { describe, ignored } from '../geometry';
import type { Finding, Rule, Severity, Thresholds } from '../types';

/** Pure classification of a contrast ratio: error below `error`, warning below `warn` for small text. */
export function classifyContrast(ratio: number, large: boolean, t: Thresholds['contrast']): Severity | null {
  if (ratio < t.error) return 'error';
  if (ratio < t.warn && !large) return 'warn';
  return null;
}

/** WCAG "large text": >= 24px, or >= 18.66px bold (at 1080p, scaled with the frame's short side). */
export const isLargeText = (screenPx: number, bold: boolean, shortSide: number, t: Thresholds['contrast']) => {
  const k = shortSide / 1080;
  return screenPx >= t.largePx1080 * k || (bold && screenPx >= 18.66 * k);
};

export const toRgb = (c: { r: number; g: number; b: number }) => `rgb(${c.r},${c.g},${c.b})`;

const STILL_PX = 1;
/** Cambio de opacidad por cuadro con el que el texto ya no es "quieto": el tramo final de un fundido con easing cambia menos de 0.02 por cuadro, pero nunca 0 (un texto quieto da exactamente 0). */
const STILL_FADE = 0.003;
/** Cambio minimo de opacidad del velo entre cuadros vecinos para decir que esta cruzando. */
const VEIL_FADE = 0.02;

/** Text colour (times the element opacity) against the background sampled with the text hidden. */
export const contrastRule: Rule = {
  id: 'contrast',
  description: 'Contraste insuficiente entre el texto y el fondo real',
  check({ frame, width, height, runs, thresholds }) {
    const t = thresholds.contrast;
    const out: Finding[] = [];
    const seen = new Set<number>();
    for (const r of runs) {
      if (!r.bg || r.transparentFill || r.opacity < 0.05 || ignored(r, 'contrast') || r.decor || seen.has(r.elId)) continue;
      const m = /rgba?\(([^)]+)\)/.exec(r.color);
      if (!m) continue;
      const [cr, cg, cb, ca = '1'] = m[1]!.split(/[,\s/]+/).filter(Boolean);
      // Texto quieto (sin movimiento ni fundido entre cuadros vecinos): se ve tal cual esta dibujado, asi que se juzga con la opacidad
      // compuesta. Texto en fundido o en movimiento: un cuadro asentado lo mostraria opaco, se juzga por su propio color (salvo que sea muy tenue).
      const still = (r.motion ?? 0) <= STILL_PX && (r.fade ?? 0) <= STILL_FADE;
      const alpha = Math.min(1, Number(ca) * (r.opacity < t.minOpacity || still ? r.opacity : 1));
      let ratio: number;
      try {
        ratio = contrastRatio(`rgba(${cr},${cg},${cb},${alpha})`, toRgb(r.bg));
      } catch {
        continue;
      }
      let sev: Severity | null = classifyContrast(ratio, isLargeText(r.screenPx, r.bold, Math.min(width, height), t), t);
      if (!sev) continue;
      if (r.opacity < t.minOpacity) sev = 'info'; // muy tenue: decorativo o a mitad de un fundido
      // Texto bajo un velo de cuadro completo que cambia de opacidad entre cuadros vecinos (un `Wash` que cruza): es una transicion, como un
      // texto en fundido. Un velo semitransparente QUIETO (fade ~ 0) sigue siendo error: ese contraste es el que se ve.
      const veilCrossing = !!r.veil && (r.veil.fade ?? 0) > VEIL_FADE;
      if (veilCrossing) sev = 'info';
      // Texto en fundido junto con la superficie que pinta su fondo (un panel con su contenido que entra a la vez): el fondo muestreado esta
      // mezclado con el de atras y el texto tambien, asi que el cuadro es una transicion, no un defecto. Un panel quieto sigue juzgandose.
      const surfaceFading = !!r.fadingBg && (r.fade ?? 0) > STILL_FADE;
      if (surfaceFading) sev = 'info';
      // Texto en movimiento (una tarjeta que vuela, un titular que entra): el fondo que tiene debajo cambia de un cuadro al siguiente, asi que
      // el cuadro es parte de una transicion. Quieto sigue juzgandose (un texto fijo con mal contraste es un defecto).
      const crossing = (r.motion ?? 0) > thresholds.motion.crossPx;
      if (crossing) sev = 'info';
      seen.add(r.elId);
      out.push({
        rule: 'contrast', severity: sev, frame,
        message: `contraste ${ratio.toFixed(2)}:1 (${ratio < t.error ? `minimo ${t.error}` : `recomendado ${t.warn}`}:1)${r.opacity < t.minOpacity ? ` con opacidad ${r.opacity.toFixed(2)} (muy tenue)` : still && r.opacity < 0.99 ? ` con opacidad ${r.opacity.toFixed(2)} (quieto, se juzga como se ve)` : ''} ${r.color} sobre ${toRgb(r.bg)}${crossing ? '; el texto se mueve entre cuadros (transicion), no se juzga' : ''}${surfaceFading ? '; el texto y la superficie de su fondo estan en fundido a la vez: transicion, no se juzga' : ''}${veilCrossing ? `; bajo un velo de cuadro completo que cruza (opacidad ${r.veil!.opacity.toFixed(2)}, cambia ${(r.veil!.fade ?? 0).toFixed(2)} por cuadro): transicion, no se juzga` : r.veil ? `; bajo un velo de cuadro completo QUIETO (opacidad ${r.veil.opacity.toFixed(2)}): el texto se ve asi; aclarar el velo, subir el contraste o quitarlo` : ''}`,
        element: describe(r), data: { ratio: Math.round(ratio * 100) / 100 },
      });
    }
    return out;
  },
};
