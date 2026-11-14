import type { RuleContext, TextRun } from '../types';
import { ALL_RULES } from '../types';

/** El texto se ve en pantalla segun la evidencia de pixeles (captura normal contra captura con el texto oculto, qa/png.ts). `undefined`: no hay evidencia. */
export const inkVisible = (r: TextRun, minFraction: number): boolean | undefined => (r.ink ? r.ink.frac >= minFraction : undefined);

/** El texto esquiva TODAS las reglas por `data-qa-ignore` (`all`, o una por una). Es una decision explicita de quien escribio la escena. */
export const ignoresEverything = (r: Pick<TextRun, 'ignore'>) => r.ignore.includes('all') || ALL_RULES.filter((x) => x !== 'unjudged').every((x) => r.ignore.includes(x));

/**
 * El control CREE que el texto esta tapado por una capa opaca de cuadro completo: la tapa que informa `covered` (>= `maxCoverFraction` del
 * cuadro) o una capa lisa y cerrada del todo marcada `data-qa-ignore="covered"` que cubre todos sus puntos (`hiddenBy`).
 */
export function looksHidden(r: TextRun, ctx: Pick<RuleContext, 'width' | 'height' | 'thresholds'>): boolean {
  const limit = ctx.thresholds.covered.maxCoverFraction * ctx.width * ctx.height;
  return !!(r.cover && r.cover.rect.w * r.cover.rect.h >= limit) || !!r.hiddenBy;
}

/**
 * Textos que las reglas geometricas juzgan. Un texto SOLO se descarta si de verdad no se ve: lo tapa una capa opaca de cuadro completo
 * (nunca una marcada `data-qa-ignore="covered"` que no sea lisa y cerrada del todo, ni un degradado con transparencias: eso lo resuelve la
 * recoleccion en la pagina) Y, si hay evidencia de pixeles, la captura confirma que no se ve. Si los pixeles dicen que el texto se ve, se juzga
 * igual: una heuristica equivocada no puede dejar ciego al control (y la regla `unjudged` lo cuenta; ver `hiddenButVisible`).
 * No es silencioso: `covered` informa la tapa y el resumen cuenta cuantos textos quedaron sin juzgar y por que.
 */
export function visibleRuns(ctx: RuleContext): RuleContext['runs'] {
  return ctx.runs.filter((r) => !(looksHidden(r, ctx) && inkVisible(r, ctx.thresholds.unjudged.minFraction) !== true));
}
