import { describe, ignored } from '../geometry';
import type { Finding, Rule } from '../types';

/**
 * Aviso (no error): texto de un SVG (`<text>`) que queda bajo un `scale()` de un ancestro (una miniatura achicada, una escena anidada, una cámara con
 * zoom) sin `text-rendering: geometricPrecision`. Chromium elige el cuerpo de la letra según la escala del último diseño y esa escala depende del
 * historial de cuadros: el mismo cuadro puede salir distinto según qué se dibujó antes (`render --check` falla en el texto y en los trazos cercanos).
 * Arreglo: `text-rendering: geometricPrecision` en el `<svg>` o en el `<text>` (docs/reglas.md, "Qué hacer cuando --check falla").
 * Se calla con `data-qa-ignore="svg-escala"`.
 */
const ESCALA_MIN = 0.01; // |escala - 1| a partir de la cual el texto está escalado

export const svgEscalaRule: Rule = {
  id: 'svg-escala',
  description: 'Texto SVG bajo un scale() sin text-rendering: geometricPrecision (aviso)',
  check({ frame, runs }) {
    const out: Finding[] = [];
    const seen = new Set<number>();
    for (const r of runs) {
      if (!r.svgText || r.svgPrecise || ignored(r, 'svg-escala') || seen.has(r.elId)) continue;
      if (!(Math.abs(r.scale - 1) > ESCALA_MIN)) continue;
      seen.add(r.elId);
      out.push({
        rule: 'svg-escala', severity: 'warn', frame,
        message: `texto SVG bajo un scale() de ${r.scale.toFixed(2)} sin text-rendering: geometricPrecision: puede rasterizarse distinto según el historial de cuadros (render --check); ponerlo en el <svg> o en el <text>`,
        element: describe(r), data: { scale: Math.round(r.scale * 1000) / 1000 },
      });
    }
    return out;
  },
};
