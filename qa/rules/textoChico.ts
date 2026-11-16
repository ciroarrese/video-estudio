import { describe, ignored } from '../geometry';
import type { Finding, Rule } from '../types';

/**
 * Aviso (no error): texto visible que en pantalla queda por debajo de `minPx1080` (20 por defecto, referido a 1080 px del lado corto del cuadro, como `min-size`)
 * durante un plano sostenido: el texto no se mueve ni cambia de opacidad entre cuadros vecinos (no es un zoom, un vuelo ni un fundido). El tamaño es el de pantalla:
 * el de la letra por la escala de la cámara. Complementa a `min-size`: `min-size` es el error (menos de 18) y esta regla avisa de lo que sigue chico sin llegar a error
 * (de 18 a 20, o hasta donde se suba el piso con `--set texto-chico.minPx1080=N`); lo que `min-size` ya juzga como error no se repite acá.
 * Se calla con `data-qa-decor` (adorno de una interfaz recreada) o `data-qa-ignore="texto-chico"`.
 */
const STILL_PX = 4;
const STILL_FADE = 0.02;

export const textoChicoRule: Rule = {
  id: 'texto-chico',
  description: 'Texto chico en pantalla durante un plano sostenido (aviso)',
  check({ frame, width, height, runs, thresholds }) {
    const t = thresholds['texto-chico'];
    const k = Math.min(width, height) / 1080;
    const floor = t.minPx1080 * k;
    const hard = thresholds['min-size'].minPx1080 * k - thresholds['min-size'].tolerancePx; // por debajo de esto ya es error de min-size
    const out: Finding[] = [];
    const seen = new Set<number>();
    for (const r of runs) {
      if (r.opacity < t.minOpacity || ignored(r, 'texto-chico') || r.decor || seen.has(r.elId)) continue;
      if (r.screenPx >= floor - t.tolerancePx || r.screenPx < hard) continue;
      if ((r.motion ?? 0) > STILL_PX || (r.fade ?? 0) > STILL_FADE) continue; // en movimiento o en fundido: no es un plano sostenido
      seen.add(r.elId);
      out.push({
        rule: 'texto-chico', severity: 'warn', frame,
        message: `texto de ${r.screenPx.toFixed(1)}px en pantalla en un plano sostenido (piso ${floor.toFixed(1)}px): se lee justo; subirlo, o marcarlo decorativo (data-qa-decor) si no hay que leerlo`,
        element: describe(r), data: { screenPx: Math.round(r.screenPx * 10) / 10, floor: Math.round(floor * 10) / 10 },
      });
    }
    return out;
  },
};
