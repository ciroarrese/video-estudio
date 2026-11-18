import { analyzeJumps } from '../salto';
import type { Rule } from '../types';

/** Saltos entre cuadros vecinos (ver `qa/salto.ts`: criterios, umbrales y qué no cuenta como salto). Solo corre con `ctx.around` y marcas `data-qa-world`/`data-qa-overlay`/`data-qa-target`. */
export const saltoRule: Rule = {
  id: 'salto',
  description: 'Un elemento salta de golpe en un solo cuadro, o una capa fija cambia de lado respecto de su objetivo',
  check: (ctx) => analyzeJumps(ctx).findings,
};
