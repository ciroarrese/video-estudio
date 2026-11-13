import { cpus } from 'node:os';
import { applyMotion, coverKeys } from './motion';
import { collectRuns, sampleBackgrounds } from './page';
import { ALL_RULES, type Finding, type RuleId, type Severity } from './types';
import { runRules } from './rules';
import { sampleFrames, type SampleSpec } from './sampling';
import { openSession, sceneFrames } from './session';
import type { FormatName } from '../engine';
import { mergeThresholds, type ThresholdOverrides } from './thresholds';

export type QaOptions = SampleSpec & {
  videoId: string;
  props?: Record<string, unknown>;
  format?: FormatName;
  /** Solo esta escena (id/nombre o índice desde 0). */
  scene?: string;
  /** Rules to run (default: all). */
  rules?: RuleId[];
  thresholds?: ThresholdOverrides;
  /** Pages in parallel (default min(cpus, 3)). */
  concurrency?: number;
  log?: (m: string) => void;
};

export type QaSummary = {
  videoId: string;
  frames: number[];
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  byRule: Record<string, number>;
  seconds: number;
};
export type QaResult = { findings: Finding[]; summary: QaSummary };

export async function runQa(o: QaOptions): Promise<QaResult> {
  const t0 = Date.now();
  const thresholds = mergeThresholds(o.thresholds);
  const rules = o.rules ?? ALL_RULES;
  const session = await openSession({ videoId: o.videoId, props: o.props, format: o.format, log: o.log });
  try {
    const { meta } = session;
    const frames = sampleFrames(o, meta.durationInFrames, 24, await sceneFrames(session, o.scene));
    const workers = Math.max(1, Math.min(o.concurrency ?? Math.min(cpus().length, 3), frames.length));
    const queue = [...frames];
    const findings: Finding[] = [];
    await Promise.all(
      Array.from({ length: workers }, async () => {
        const vp = await session.openPage();
        for (let f = queue.shift(); f !== undefined; f = queue.shift()) {
          await vp.setFrame(f);
          const data = await collectRuns(vp, meta.width, meta.height);
          if (rules.includes('contrast')) await sampleBackgrounds(vp, data.runs);
          // Motion: compare with the neighbouring frames (f-1, f+1) to tell transitions from static defects.
          const keys = coverKeys(data);
          const neighbours = [];
          for (const n of [f - 1, f + 1]) {
            if (n < 0 || n >= meta.durationInFrames) continue;
            await vp.setFrame(n);
            neighbours.push(await collectRuns(vp, meta.width, meta.height, keys));
          }
          applyMotion(data, neighbours);
          findings.push(...runRules({ frame: f, width: meta.width, height: meta.height, runs: data.runs, thresholds }, rules));
        }
      }),
    );
    findings.sort((a, b) => a.frame - b.frame || a.rule.localeCompare(b.rule));
    const byRule: Record<string, number> = {};
    for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
    return {
      findings,
      summary: {
        videoId: o.videoId, frames: frames.slice().sort((a, b) => a - b), total: findings.length,
        errors: findings.filter((f) => f.severity === 'error').length,
        warnings: findings.filter((f) => f.severity === 'warn').length,
        infos: findings.filter((f) => f.severity === 'info').length,
        byRule, seconds: Math.round((Date.now() - t0) / 100) / 10,
      },
    };
  } finally {
    await session.close();
  }
}

export const failsAt = (r: QaResult, level: Severity) => (level === 'warn' ? r.summary.errors + r.summary.warnings > 0 : r.summary.errors > 0);
