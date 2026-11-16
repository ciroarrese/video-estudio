import type { Finding, Occupancy, Rule } from '../types';

/** Un hueco vertical entre tramos ocupados: de `y0` a `y1`, y dónde está (los de arriba y abajo tocan el borde del cuadro). */
export type Gap = { y0: number; y1: number; kind: 'arriba' | 'abajo' | 'en el medio' };

/** Huecos de un cuadro de alto `height` dado el reparto de tramos ocupados (ya unidos y ordenados). Sin ningún tramo no hay huecos que medir (cuadro en blanco a propósito). */
export function gapsOf(bands: number[][], height: number): Gap[] {
  if (!bands.length) return [];
  const out: Gap[] = [];
  const first = bands[0]![0]!, last = bands[bands.length - 1]![1]!;
  if (first > 0) out.push({ y0: 0, y1: first, kind: 'arriba' });
  for (let i = 0; i + 1 < bands.length; i++) out.push({ y0: bands[i]![1]!, y1: bands[i + 1]![0]!, kind: 'en el medio' });
  if (last < height) out.push({ y0: last, y1: height, kind: 'abajo' });
  return out;
}

/** El hueco `g` (o casi todo él) también está vacío en el cuadro vecino: lo contiene en al menos `share` de su alto. */
function persists(g: Gap, n: Occupancy, height: number, share = 0.8): boolean {
  const need = (g.y1 - g.y0) * share;
  return gapsOf(n.bands, height).some((h) => Math.min(h.y1, g.y1) - Math.max(h.y0, g.y0) >= need);
}

/**
 * Aviso (no error): en formatos angostos (vertical y cuadrado), una franja horizontal continua sin ningún elemento visible que ocupa al menos `minFraction` (30 %) del alto del
 * cuadro, durante un plano sostenido (el mismo hueco en los cuadros vecinos y sin un velo de transición cruzando). "Elemento visible" es todo lo que pinta algo: texto, fondo, borde,
 * imagen, svg; los fondos que cubren el cuadro entero no cuentan (son el escenario). Un hueco entre elementos (en el medio) avisa siempre; uno en el borde de arriba o de abajo, solo si no
 * hay uno parecido en el borde opuesto (al menos `balance` de él): un contenido centrado es una composición, no un hueco. Se calla con `data-qa-ignore="vacio"` en lo que no cuenta
 * (un adorno que llena el cuadro de punta a punta) o en el que ocupa a propósito. Es una pista de composición: se mira en la hoja (`npm run sheet`).
 */
export const vacioRule: Rule = {
  id: 'vacio',
  description: 'Franja horizontal vacía durante un plano sostenido (aviso, solo vertical y cuadrado)',
  check({ frame, width, height, thresholds, occupancy, neighbourOccupancy }) {
    if (!occupancy || width / height >= 1.3) return [];
    const t = thresholds.vacio;
    if (occupancy.veil > 0.02) return []; // un velo cruzando: transición
    if ((neighbourOccupancy ?? []).some((n) => n.veil > 0.02)) return [];
    const gaps = gapsOf(occupancy.bands, height);
    const len = (g: Gap) => g.y1 - g.y0;
    const out: Finding[] = [];
    for (const g of gaps) {
      if (len(g) < t.minFraction * height) continue;
      if (g.kind !== 'en el medio') {
        const opposite = gaps.find((h) => h.kind === (g.kind === 'arriba' ? 'abajo' : 'arriba'));
        if (opposite && len(opposite) >= t.balance * len(g)) continue; // contenido centrado
      }
      if (!(neighbourOccupancy ?? []).every((n) => persists(g, n, height))) continue; // no es un plano sostenido
      const pct = Math.round((100 * len(g)) / height);
      out.push({
        rule: 'vacio', severity: 'warn', frame,
        message: `franja vacía ${g.kind} de ${Math.round(len(g))}px (${pct}% del alto, de y=${Math.round(g.y0)} a y=${Math.round(g.y1)}) sin ningún elemento visible en un plano sostenido: llenarla, repartir mejor el contenido o ajustar el encuadre; si es a propósito, data-qa-ignore="vacio"`,
        element: { tag: 'franja', testid: null, text: `franja vacía ${g.kind}`, rect: { x: 0, y: Math.round(g.y0), w: width, h: Math.round(len(g)) } },
        data: { y0: Math.round(g.y0), y1: Math.round(g.y1), pct },
      });
    }
    return out;
  },
};
