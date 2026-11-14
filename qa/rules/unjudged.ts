import { describe } from '../geometry';
import type { Finding, Rule, RuleContext } from '../types';
import { ignoresEverything, inkVisible, visibleRuns } from './visible';

/**
 * Red de seguridad contra la ceguera del control: un texto que SE VE en la captura (los pixeles de su caja cambian al ocultarlo) y que
 * ninguna regla juzgo es un error. No es del video sino del control: antes, una viñeta de cuadro completo hacia que el control descartara
 * todo el texto de abajo y "0 errores" no queria decir nada. Quedan afuera los textos que la escena excluye a proposito con
 * `data-qa-ignore="all"` (se cuentan en el resumen) y los casi transparentes (< 0.05).
 */
export function checkUnjudged(ctx: RuleContext, judgedRuns: (ctx: RuleContext) => RuleContext['runs']): Finding[] {
  const judged = new Set(judgedRuns(ctx).map((r) => r.id));
  const out: Finding[] = [];
  const seen = new Set<number>();
  for (const r of ctx.runs) {
    if (judged.has(r.id) || r.opacity < 0.05 || ignoresEverything(r) || seen.has(r.elId)) continue;
    if (inkVisible(r, ctx.thresholds.unjudged.minFraction) !== true) continue;
    seen.add(r.elId);
    out.push({
      rule: 'unjudged', severity: 'error', frame: ctx.frame,
      message: `el texto se ve en pantalla (${Math.round((r.ink?.frac ?? 0) * 100)}% de sus pixeles cambian al ocultarlo) y ninguna regla lo juzgo${r.cover ? ` (el control lo daba por tapado por ${r.cover.testid ?? r.cover.tag})` : r.hiddenBy ? ` (el control lo daba por tapado por ${r.hiddenBy.testid ?? 'una capa'})` : ''}: es un defecto del control, no del video`,
      element: describe(r), data: { ink: Math.round((r.ink?.frac ?? 0) * 100) / 100 },
    });
  }
  return out;
}

export const unjudgedRule: Rule = {
  id: 'unjudged',
  description: 'Texto que se ve en pantalla y no lo juzgo ninguna regla (defecto del control)',
  check: (ctx) => checkUnjudged(ctx, visibleRuns),
};
