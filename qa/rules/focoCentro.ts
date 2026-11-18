import { roundRect } from '../geometry';
import type { Finding, Rule } from '../types';

/**
 * Foco centrado (tutoriales de interfaz con cámara guiada). Con la cámara asentada (algún `data-qa-world` lleva `data-qa-settled`), el objetivo de la señal
 * activa (`data-qa-target`) tiene que quedar en el centro del cuadro: lo que se señala va al centro de la pantalla.
 *
 * Medida: el desvío del CENTRO del objetivo respecto del centro del cuadro, por eje y normalizado por la mitad del cuadro (0 = en el centro, 1 = en el borde);
 * cuenta el mayor de los dos ejes. Zona: el `zone` central (0,6 = el 60 % central de cada eje, o sea desvío <= 0,6).
 *  - dentro de la zona: nada.
 *  - aviso: fuera de la zona, hasta un desvío de `error` (0,85).
 *  - error: desvío mayor que `error` (el centro cae en el 15 % exterior), o el objetivo queda del todo fuera del cuadro.
 * Se mide el centro y no los bordes a propósito: un objetivo más ancho que el área útil no cabe y se encuadra por el centro. Sin `data-qa-settled`
 * (la cámara viaja, o el video no marca asentado) no se juzga: un objetivo en camino no es un defecto. Se calla con `data-qa-ignore="foco-centro"` en el objetivo.
 */
export const focoCentroRule: Rule = {
  id: 'foco-centro',
  description: 'El objetivo señalado no queda en el centro del cuadro con la cámara asentada',
  check({ frame, width, height, worlds, targets, thresholds }) {
    const t = thresholds['foco-centro'];
    if (!(worlds ?? []).some((w) => w.settled)) return [];
    const out: Finding[] = [];
    for (const g of targets ?? []) {
      if (g.opacity < t.minOpacity || g.ignore.includes('foco-centro') || g.ignore.includes('all') || g.rect.w < 1 || g.rect.h < 1) continue;
      const cx = g.rect.x + g.rect.w / 2, cy = g.rect.y + g.rect.h / 2;
      const outside = g.rect.x >= width || g.rect.y >= height || g.rect.x + g.rect.w <= 0 || g.rect.y + g.rect.h <= 0;
      const dev = Math.max(Math.abs(cx - width / 2) / (width / 2), Math.abs(cy - height / 2) / (height / 2));
      if (!outside && dev <= t.zone) continue;
      const severe = outside || dev > t.error;
      out.push({
        rule: 'foco-centro', severity: severe ? 'error' : 'warn', frame,
        message: `${outside ? 'el objetivo señalado esta fuera del cuadro' : `el centro del objetivo señalado se aparta ${Math.round(dev * 100)}% del centro del cuadro (zona ${Math.round(t.zone * 100)}% central${severe ? `, error desde ${Math.round(t.error * 100)}%` : ''})`} con la camara asentada (data-qa-settled): lo que se señala va al centro. Arreglo: centrar la camara en el objetivo`,
        element: { tag: g.tag, testid: g.testid, text: g.text, rect: roundRect(g.rect) },
        data: { deviation: Math.round(dev * 100) / 100, cx: Math.round(cx), cy: Math.round(cy) },
      });
    }
    return out;
  },
};
