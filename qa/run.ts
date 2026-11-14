import { cpus } from 'node:os';
import { applyMotion, coverKeys } from './motion';
import { collectRuns, sampleBackgrounds } from './page';
import { ALL_RULES, type DecorSummary, type DetailSummary, type FixedScaleSummary, type JudgedSummary, type SilencedSummary, type Finding, type RuleId, type Severity } from './types';
import { addJudged, emptyJudged, runRulesCounted } from './rules';
import { sampleFrames, type SampleSpec } from './sampling';
import { openSession, sceneFrames, type Stress } from './session';
import type { FormatName } from '../engine';
import { mergeThresholds, type ThresholdOverrides } from './thresholds';
import { candidatesOf, probeReadable, reclassifyDetail } from './zoom';

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
  /** Carpetas extra de estáticos (`--assets`), como en `render`. */
  assets?: string[];
  /** Borrador: una fuente que no carga solo avisa. */
  allowMissingFonts?: boolean;
  /** Prueba de estres de tipografia (`--font-scale`, `--font-fallback`): ver qa/session.ts `Stress`. */
  stress?: Stress;
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
  /** Textos chicos que se leen al acercar (info) dentro de su escena: cuántos textos distintos y en cuántos cuadros (ver qa/zoom.ts). */
  detailSmallText?: DetailSummary;
  /** Hallazgos que callaron `data-qa-ignore` y `data-qa-decor`, por regla: callar tiene que verse. */
  silenced?: SilencedSummary;
  /** Textos de adorno (`data-qa-decor`) que se dejaron fuera de `min-size` y `contrast`. */
  decor?: DecorSummary;
  /** Textos que `data-qa-fixed-scale` dejó fuera del estrés de tipografía (solo con `--font-scale`); `refused` si la marca se rechazó. */
  fixedScale?: FixedScaleSummary;
  /** Cuanto texto juzgo el control y cuanto no (y por que): el control que "da 0 errores" sin mirar nada tiene que notarse. */
  judged: JudgedSummary;
  /** Estres de tipografia con el que se corrio (si hubo). */
  stress?: Stress;
  seconds: number;
};
export type QaResult = { findings: Finding[]; summary: QaSummary };

/**
 * `data-qa-fixed-scale` exime a un subárbol solo del estrés de `--font-scale`. Se rechaza (el estrés se aplica igual y el resumen lo dice con
 * `fixedScale.refused`) si la marca cubre todo el escenario y en ningún cuadro revisado queda otro texto fuera de ella: sería apagar el estrés del video entero.
 */
export async function runQa(o: QaOptions): Promise<QaResult> {
  const scaled = o.stress?.fontScale !== undefined && o.stress.fontScale !== 1;
  const first = await runQaPass(o, true);
  if (!scaled || !first.fixed || !first.fixed.refuse) return first.result;
  const again = await runQaPass(o, false);
  again.result.summary.fixedScale = { texts: first.fixed.texts, frames: first.fixed.frames, refused: true };
  return again.result;
}

async function runQaPass(o: QaOptions, honorFixedScale: boolean): Promise<{ result: QaResult; fixed: { texts: number; frames: number; refuse: boolean } | null }> {
  const t0 = Date.now();
  const thresholds = mergeThresholds(o.thresholds);
  const rules = o.rules ?? ALL_RULES;
  const session = await openSession({ videoId: o.videoId, props: o.props, format: o.format, assets: o.assets, allowMissingFonts: o.allowMissingFonts, stress: o.stress, honorFixedScale, log: o.log });
  try {
    const { meta } = session;
    const frames = sampleFrames(o, meta.durationInFrames, 24, await sceneFrames(session, o.scene));
    const workers = Math.max(1, Math.min(o.concurrency ?? Math.min(cpus().length, 3), frames.length));
    const queue = [...frames];
    const findings: Finding[] = [];
    const silenced: SilencedSummary = {};
    const judged = emptyJudged();
    const decorTexts = new Set<string>();
    const decorFrames = new Set<number>();
    const scaled = o.stress?.fontScale !== undefined && o.stress.fontScale !== 1;
    const fixedTexts = new Set<string>();
    const fixedFrames = new Set<number>();
    let otherText = false, fullCover = false;
    await Promise.all(
      Array.from({ length: workers }, async () => {
        const vp = await session.openPage();
        for (let f = queue.shift(); f !== undefined; f = queue.shift()) {
          await vp.setFrame(f);
          const data = await collectRuns(vp, meta.width, meta.height);
          // Capturas (normal y con el texto oculto): el fondo para `contrast` y la evidencia de que el texto se ve para `visibleRuns` y `unjudged`.
          if (rules.includes('contrast') || rules.includes('unjudged')) await sampleBackgrounds(vp, data.runs, { bg: rules.includes('contrast'), ink: true });
          // Motion: compare with the neighbouring frames (f-1, f+1) to tell transitions from static defects.
          const keys = coverKeys(data);
          const neighbours = [];
          for (const n of [f - 1, f + 1]) {
            if (n < 0 || n >= meta.durationInFrames) continue;
            await vp.setFrame(n);
            neighbours.push(await collectRuns(vp, meta.width, meta.height, keys));
          }
          applyMotion(data, neighbours);
          const r = runRulesCounted({ frame: f, width: meta.width, height: meta.height, runs: data.runs, thresholds }, rules);
          findings.push(...r.findings);
          addJudged(judged, r.judged);
          for (const [rule, c] of Object.entries(r.silenced)) {
            const t = (silenced[rule] ??= { ignore: 0, decor: 0 });
            t.ignore += c.ignore;
            t.decor += c.decor;
          }
          if (scaled) {
            for (const run of data.runs) {
              if (run.fixedScale) { fixedTexts.add(run.key); fixedFrames.add(f); } else if (run.opacity >= 0.05 && !run.ignore.includes('all')) otherText = true;
            }
            if ((data.fixedRoots ?? []).some((r) => r.w * r.h >= 0.9 * meta.width * meta.height)) fullCover = true;
          }
          for (const run of data.runs) if (run.decor) { decorTexts.add(run.key); decorFrames.add(f); }
        }
      }),
    );
    // Detalle que se lee al acercar: un texto chico en el plano general que dentro de la misma escena se ve por encima del mínimo
    // en otro cuadro deja de ser error (ver qa/zoom.ts). Solo si hubo errores de tamaño y no se apagó con probeFrames=0.
    let detail: DetailSummary | null = null;
    const candidates = rules.includes('min-size') && thresholds['min-size'].probeFrames > 0 ? candidatesOf(findings) : [];
    if (candidates.length) {
      const scenes = await session.scenes().catch(() => []);
      const dims = { width: meta.width, height: meta.height, duration: meta.durationInFrames };
      const readable = await probeReadable(session, candidates, scenes, frames, thresholds, dims);
      const r = reclassifyDetail(findings, readable, scenes, thresholds, dims);
      findings.length = 0;
      findings.push(...r.findings);
      detail = r.detail;
    }
    findings.sort((a, b) => a.frame - b.frame || a.rule.localeCompare(b.rule));
    const byRule: Record<string, number> = {};
    for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
    const fixed = scaled && fixedTexts.size ? { texts: fixedTexts.size, frames: fixedFrames.size, refuse: fullCover && !otherText } : null;
    const result: QaResult = {
      findings,
      summary: {
        videoId: o.videoId, frames: frames.slice().sort((a, b) => a - b), total: findings.length,
        errors: findings.filter((f) => f.severity === 'error').length,
        warnings: findings.filter((f) => f.severity === 'warn').length,
        infos: findings.filter((f) => f.severity === 'info').length,
        byRule, ...(detail ? { detailSmallText: detail } : {}),
        // Las claves de `silenced` se insertan en el orden en que terminan los cuadros (según el paralelismo): se ordenan para que el informe sea idéntico entre corridas.
        ...(Object.keys(silenced).length ? { silenced: Object.fromEntries(Object.entries(silenced).sort(([a], [b]) => a.localeCompare(b))) } : {}),
        ...(decorTexts.size ? { decor: { texts: decorTexts.size, frames: decorFrames.size } } : {}), judged, ...(o.stress ? { stress: o.stress } : {}),
        ...(fixed && !fixed.refuse ? { fixedScale: { texts: fixed.texts, frames: fixed.frames } } : {}), seconds: Math.round((Date.now() - t0) / 100) / 10,
      },
    };
    return { result, fixed };
  } finally {
    await session.close();
  }
}

export const failsAt = (r: QaResult, level: Severity) => (level === 'warn' ? r.summary.errors + r.summary.warnings > 0 : r.summary.errors > 0);
