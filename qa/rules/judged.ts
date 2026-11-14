import { intersect } from '../geometry';
import type { JudgedSummary, RuleContext } from '../types';
import { ALL_RULES } from '../types';
import { ignoresEverything, inkVisible, looksHidden, visibleRuns } from './visible';

export const emptyJudged = (): JudgedSummary => ({
  texts: 0, judged: 0, notJudged: { total: 0, hidden: 0, ignoredAll: 0, outside: 0, invisible: 0 },
  partial: { decor: 0, veil: 0, ignoredSome: 0, gradientText: 0 }, ignoredByRule: {}, coverMarkerSkipped: 0, hiddenButVisible: 0, unjudgedVisible: 0,
});

/** Suma `b` en `a` (el resumen del informe junta los cuadros). */
export function addJudged(a: JudgedSummary, b: JudgedSummary): void {
  a.texts += b.texts; a.judged += b.judged;
  for (const k of Object.keys(a.notJudged) as (keyof JudgedSummary['notJudged'])[]) a.notJudged[k] += b.notJudged[k];
  for (const k of Object.keys(a.partial) as (keyof JudgedSummary['partial'])[]) a.partial[k] += b.partial[k];
  for (const [k, v] of Object.entries(b.ignoredByRule)) a.ignoredByRule[k] = (a.ignoredByRule[k] ?? 0) + v;
  a.coverMarkerSkipped += b.coverMarkerSkipped; a.hiddenButVisible += b.hiddenButVisible; a.unjudgedVisible += b.unjudgedVisible;
}

/**
 * Cuenta, para un cuadro, cuantos textos juzgo el control y cuantos NO (y por que). Orden de los motivos: fuera del cuadro (no se ve),
 * casi transparente (< 0.05), tapado por una capa opaca de cuadro completo, excluido por `data-qa-ignore` de todas las reglas. El resto se
 * juzga, y se anota lo que se juzgo solo en parte (adorno, velo de transicion, marcas de algunas reglas).
 */
export function judgement(ctx: RuleContext): JudgedSummary {
  const s = emptyJudged();
  const frame = { x: 0, y: 0, w: ctx.width, h: ctx.height };
  const vis = new Set(visibleRuns(ctx).map((r) => r.id));
  const minFrac = ctx.thresholds.unjudged.minFraction;
  for (const r of ctx.runs) {
    s.texts++;
    if (r.skippedCovers) s.coverMarkerSkipped++;
    if (looksHidden(r, ctx) && inkVisible(r, minFrac) === true) s.hiddenButVisible++;
    if (!intersect(r.rect, frame)) { s.notJudged.outside++; s.notJudged.total++; continue; }
    if (r.opacity < 0.05) { s.notJudged.invisible++; s.notJudged.total++; continue; }
    if (!vis.has(r.id)) {
      s.notJudged.hidden++; s.notJudged.total++;
      if (inkVisible(r, minFrac) === true && !ignoresEverything(r)) s.unjudgedVisible++; // se ve y nadie lo juzgo: error de `unjudged`
      continue;
    }
    if (ignoresEverything(r)) { s.notJudged.ignoredAll++; s.notJudged.total++; continue; } // decision explicita de la escena: se cuenta, no es un error
    s.judged++;
    if (r.decor) s.partial.decor++;
    if (r.veil) s.partial.veil++;
    if (r.transparentFill) s.partial.gradientText++;
    const some = ALL_RULES.filter((x) => x !== 'unjudged' && (r.ignore.includes(x) || r.ignore.includes('all')));
    if (some.length) { s.partial.ignoredSome++; for (const x of some) s.ignoredByRule[x] = (s.ignoredByRule[x] ?? 0) + 1; }
  }
  return s;
}
