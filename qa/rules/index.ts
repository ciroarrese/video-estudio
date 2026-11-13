import type { Finding, Rule, RuleContext, RuleId } from '../types';
import { clipRule } from './clip';
import { contrastRule } from './contrast';
import { coveredRule } from './covered';
import { minSizeRule } from './minSize';
import { offscreenRule } from './offscreen';
import { overlapRule } from './overlap';
import { safeAreaRule } from './safeArea';

export const RULES: Rule[] = [clipRule, offscreenRule, safeAreaRule, overlapRule, minSizeRule, contrastRule, coveredRule];

/**
 * Text under an opaque element that spans (nearly) the whole frame is not on screen: the geometric rules skip it so they do not
 * pile up noise on a scene change. It is NOT silent: the `covered` rule reports it (see covered.ts).
 */
export function visibleRuns(ctx: RuleContext): RuleContext['runs'] {
  const limit = ctx.thresholds.covered.maxCoverFraction * ctx.width * ctx.height;
  return ctx.runs.filter((r) => !(r.cover && r.cover.rect.w * r.cover.rect.h >= limit));
}

export function runRules(ctx: RuleContext, enabled?: RuleId[]): Finding[] {
  const vis = { ...ctx, runs: visibleRuns(ctx) };
  return RULES.filter((r) => !enabled || enabled.includes(r.id)).flatMap((r) => r.check(r.id === 'covered' ? ctx : vis));
}
