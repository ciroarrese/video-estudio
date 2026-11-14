import type { Finding, JudgedSummary, Rule, RuleContext, RuleId, SilencedSummary } from '../types';
import { clipRule } from './clip';
import { contrastRule } from './contrast';
import { coveredRule } from './covered';
import { minSizeRule } from './minSize';
import { offscreenRule } from './offscreen';
import { overlapRule } from './overlap';
import { safeAreaRule } from './safeArea';
import { judgement } from './judged';
import { unjudgedRule } from './unjudged';
import { visibleRuns } from './visible';

export { visibleRuns } from './visible';
export { addJudged, emptyJudged, judgement } from './judged';

export const RULES: Rule[] = [clipRule, offscreenRule, safeAreaRule, overlapRule, minSizeRule, contrastRule, coveredRule, unjudgedRule];

export function runRules(ctx: RuleContext, enabled?: RuleId[]): Finding[] {
  const vis = { ...ctx, runs: visibleRuns(ctx) };
  return RULES.filter((r) => !enabled || enabled.includes(r.id)).flatMap((r) => r.check(r.id === 'covered' || r.id === 'unjudged' ? ctx : vis));
}

/**
 * Igual que `runRules`, y además cuenta cuántos hallazgos callaron `data-qa-ignore` y `data-qa-decor` en cada regla: se corren las
 * reglas de nuevo sin los `data-qa-ignore` y sin los `data-qa-decor` y se compara. Así callar nunca es invisible (ver qa/README.md).
 */
export function runRulesCounted(ctx: RuleContext, enabled?: RuleId[]): { findings: Finding[]; silenced: SilencedSummary; judged: JudgedSummary } {
  const findings = runRules(ctx, enabled);
  const silenced: SilencedSummary = {};
  const count = (fs: Finding[]) => {
    const m: Record<string, number> = {};
    for (const f of fs) m[f.rule] = (m[f.rule] ?? 0) + 1;
    return m;
  };
  const base = count(findings);
  const hasIgnore = ctx.runs.some((r) => r.ignore.length > 0 || (r.cover?.ignore.length ?? 0) > 0);
  const hasDecor = ctx.runs.some((r) => r.decor);
  const add = (variant: RuleContext['runs'], kind: 'ignore' | 'decor') => {
    const c = count(runRules({ ...ctx, runs: variant }, enabled));
    for (const [rule, n] of Object.entries(c)) {
      const extra = n - (base[rule] ?? 0);
      if (extra > 0) (silenced[rule] ??= { ignore: 0, decor: 0 })[kind] += extra;
    }
  };
  if (hasIgnore) add(ctx.runs.map((r) => ({ ...r, ignore: [], cover: r.cover ? { ...r.cover, ignore: [] } : r.cover })), 'ignore');
  if (hasDecor) add(ctx.runs.map((r) => ({ ...r, decor: false, decorMain: false })), 'decor');
  return { findings, silenced, judged: judgement(ctx) };
}
