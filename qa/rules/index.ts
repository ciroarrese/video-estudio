import type { Finding, Rule, RuleContext, RuleId } from '../types';
import { clipRule } from './clip';
import { contrastRule } from './contrast';
import { coveredRule } from './covered';
import { minSizeRule } from './minSize';
import { offscreenRule } from './offscreen';
import { overlapRule } from './overlap';
import { safeAreaRule } from './safeArea';

export const RULES: Rule[] = [clipRule, offscreenRule, safeAreaRule, overlapRule, minSizeRule, contrastRule, coveredRule];

export function runRules(ctx: RuleContext, enabled?: RuleId[]): Finding[] {
  return RULES.filter((r) => !enabled || enabled.includes(r.id)).flatMap((r) => r.check(ctx));
}
