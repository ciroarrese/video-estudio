import { cpus } from 'node:os';
import { applyMotion, coverKeys } from './motion';
import { collectRuns, sampleBackgrounds, stateSignature } from './page';
import { QA_RULES, type DecorSummary, type DetailSummary, type FixedScaleSummary, type JudgedSummary, type SilencedSummary, type Finding, type RuleId, type Severity } from './types';
import { addJudged, emptyJudged, runRulesCounted } from './rules';
import { analyzeJumps, type PairStatus } from './salto';
import { DEFAULT_PARES, findTransitions } from './pares';
import { anchoredFrames, DEFAULT_PER_SCENE, sampleFrames, type SampleSpec } from './sampling';
import { openSession, sceneFrames, type Stress } from './session';
import type { FormatName } from '../engine';
import type { Around } from './types';
import { mergeThresholds, type ThresholdOverrides } from './thresholds';
import { candidatesOf, probeReadable, reclassifyDetail } from './zoom';
import { comprobarFuentesDelSistema } from '../render/fuentesSistema';

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
  /**
   * Cuadros por escena con nombre que se suman al muestreo repartido (por defecto 4): anclados al cuadro LOCAL de cada escena, no
   * cambian cuando cambia la duración del resto del video (ver `anchoredFrames`). 0 = solo el muestreo repartido. Solo en el muestreo
   * por defecto o con `count` (no con `frames`, `every` ni una escena sola).
   */
  perScene?: number;
  /**
   * Cuadros extra (`--pares`, por defecto 40) para la regla `salto`: los primeros cuadros después de cada cambio de `data-qa-settled` o de aparición del `data-qa-target`
   * (ver qa/pares.ts), cada uno con sus vecinos f-1 y f+1. Solo se agregan si el video usa esas marcas; 0 = solo los pares de los cuadros ya muestreados.
   */
  pares?: number;
  /** Carpetas extra de estáticos (`--assets`), como en `render`. */
  assets?: string[];
  /** Borrador: una fuente que no carga solo avisa. */
  allowMissingFonts?: boolean;
  /** Una familia del sistema que el tema nombra sin archivo y no está instalada hace fallar (por defecto solo avisa; `--strict-fonts`). */
  strictFonts?: boolean;
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
  /**
   * Regla `salto` (solo si el video usa `data-qa-world`, `data-qa-overlay` o `data-qa-target`): pares de cuadros consecutivos `comparados`, `juzgados` (con elementos de los dos
   * cuadros), `cortes` (el paso cruza el inicio de una escena o cambia más de la mitad del mundo: no se juzga) y cuántos cuadros se sumaron al muestreo `porTransicion`
   * alrededor de cambios de `data-qa-settled`/`data-qa-target` (`cambios`: cuántos cambios se encontraron en la grilla de sondeo).
   */
  pares?: { comparados: number; juzgados: number; cortes: number; porTransicion: number; cambios: number };
  /** De dónde salieron los cuadros: repartidos, anclados a cada escena y cuántas escenas (solo con el muestreo por defecto o `count`). */
  sampling?: { even: number; anchored: number; perScene: number; scenes: number };
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
  const rules = o.rules ?? QA_RULES;
  const session = await openSession({ videoId: o.videoId, props: o.props, format: o.format, assets: o.assets, allowMissingFonts: o.allowMissingFonts, stress: o.stress, honorFixedScale, log: o.log });
  try {
    const { meta } = session;
    // `--rules story-fit` (solo el largo del guion de la historia): no mira cuadros, así que no hay muestreo ni páginas que abrir.
    const soloFit = rules.length > 0 && rules.every((r) => r === 'story-fit');
    const range = soloFit ? undefined : await sceneFrames(session, o.scene);
    const perScene = o.perScene ?? DEFAULT_PER_SCENE;
    if (!Number.isInteger(perScene) || perScene < 0) throw new Error('--per-scene debe ser un entero >= 0');
    if (o.pares !== undefined && (!Number.isInteger(o.pares) || o.pares < 0)) throw new Error('--pares debe ser un entero >= 0');
    // Cuadros anclados a cada escena (ver `anchoredFrames`): solo con el muestreo por defecto, sin rango ni cuadros pedidos.
    const porDefecto = !soloFit && !range && o.frames === undefined && o.every === undefined && perScene > 0;
    const scenesAll = porDefecto ? await session.scenes().catch(() => []) : [];
    const anchored = porDefecto ? anchoredFrames(scenesAll, meta.durationInFrames, perScene) : [];
    const frames = soloFit ? [] : sampleFrames(o, meta.durationInFrames, 24, range, anchored);
    const evenCount = porDefecto && (o.count ?? 24) > 0 ? sampleFrames({ count: o.count }, meta.durationInFrames, 24).length : porDefecto ? 0 : frames.length;
    const sampling = porDefecto && anchored.length ? { even: evenCount, anchored: anchored.length, perScene, scenes: scenesAll.length } : undefined;
    // La ocupación del cuadro (regla `vacio`) solo se mide en formatos angostos y con la regla activa.
    const wantOccupancy = rules.includes('vacio') && meta.width / meta.height < 1.3;
    const workers = soloFit ? 0 : Math.max(1, Math.min(o.concurrency ?? Math.min(cpus().length, 3), frames.length));
    // Fuentes del sistema que el tema nombra sin archivo y no están instaladas (como `render`): avisa o, con `--strict-fonts`, falla. Una sola vez por corrida
    // y no con el estrés de fuente de reemplazo (que pisa toda la pila y haría ver como faltante a la fuente de reemplazo).
    if (honorFixedScale && !soloFit && !o.stress?.fontFallback) {
      const chk = await session.openPage();
      await comprobarFuentesDelSistema(chk.page, meta.durationInFrames, { strict: !!o.strictFonts || /^(1|true|si|sí|yes)$/i.test(process.env.VE_STRICT_FONTS ?? ''), log: o.log ?? (() => {}) });
    }
    const findings: Finding[] = [];
    const silenced: SilencedSummary = {};
    const judged = emptyJudged();
    const decorTexts = new Set<string>();
    const decorFrames = new Set<number>();
    const scaled = o.stress?.fontScale !== undefined && o.stress.fontScale !== 1;
    const fixedTexts = new Set<string>();
    const fixedFrames = new Set<number>();
    let otherText = false, fullCover = false;
    // Regla `salto`: los inicios de escena (un paso que los cruza es un corte, no un salto) y los pares ya comparados (el paso a -> a+1, una sola vez aunque lo vean dos cuadros).
    const wantSalto = rules.includes('salto') && !soloFit;
    const sceneStarts = wantSalto ? new Set((await session.scenes().catch(() => [])).map((x) => x.from)) : new Set<number>();
    const pairs = new Map<number, PairStatus>();
    let usesMarks = false;
    const processFrame = async (vp: Awaited<ReturnType<typeof session.openPage>>, f: number) => {
      await vp.setFrame(f);
      const data = await collectRuns(vp, meta.width, meta.height, [], undefined, wantOccupancy);
      if (data.worlds?.length || data.overlays?.length || data.targets?.length) usesMarks = true;
      // Capturas (normal y con el texto oculto): el fondo para `contrast` y la evidencia de que el texto se ve para `visibleRuns` y `unjudged`.
      if (rules.includes('contrast') || rules.includes('unjudged')) await sampleBackgrounds(vp, data.runs, { bg: rules.includes('contrast'), ink: true });
      // Motion: compare with the neighbouring frames (f-1, f+1) to tell transitions from static defects.
      const keys = coverKeys(data);
      const neighbours = [];
      const around: Around = {};
      for (const n of [f - 1, f + 1]) {
        if (n < 0 || n >= meta.durationInFrames) continue;
        await vp.setFrame(n);
        const nd = await collectRuns(vp, meta.width, meta.height, keys, undefined, wantOccupancy);
        neighbours.push(nd);
        if (n < f) around.prev = nd; else around.next = nd;
      }
      if (wantSalto) { around.cutPrev = sceneStarts.has(f); around.cutNext = sceneStarts.has(f + 1); }
      applyMotion(data, neighbours);
      const ctx = { frame: f, width: meta.width, height: meta.height, runs: data.runs, thresholds, signals: data.signals, worlds: data.worlds, overlays: data.overlays, targets: data.targets, ...(wantSalto ? { around } : {}), occupancy: data.occupancy, neighbourOccupancy: neighbours.flatMap((n) => (n.occupancy ? [n.occupancy] : [])) };
      const r = runRulesCounted(ctx, rules);
      findings.push(...r.findings);
      addJudged(judged, r.judged);
      if (wantSalto && (data.worlds?.length || data.overlays?.length || data.targets?.length)) {
        const st = analyzeJumps(ctx);
        if (st.prev && !pairs.has(f - 1)) pairs.set(f - 1, st.prev);
        if (st.next && !pairs.has(f)) pairs.set(f, st.next);
      }
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
    };
    const runFrames = async (list: number[]) => {
      const queue = [...list];
      const w = Math.max(1, Math.min(workers, list.length));
      await Promise.all(Array.from({ length: list.length ? w : 0 }, async () => {
        const vp = await session.openPage();
        for (let f = queue.shift(); f !== undefined; f = queue.shift()) await processFrame(vp, f);
      }));
    };
    await runFrames(frames);
    // Pares alrededor de los cambios de `data-qa-settled` / aparición del `data-qa-target` (qa/pares.ts): solo si el video usa las marcas y la regla `salto` está activa.
    let porTransicion = 0, cambios = 0;
    const paresMax = o.pares ?? DEFAULT_PARES;
    if (wantSalto && usesMarks && paresMax > 0) {
      const [a, b] = range ?? [0, meta.durationInFrames - 1];
      const probes = await Promise.all(Array.from({ length: Math.max(1, workers) }, () => session.openPage()));
      const t = await findTransitions(probes.map((vp) => async (f: number) => { await vp.setFrame(f); return stateSignature(vp); }), a, b, paresMax);
      cambios = t.found;
      const extra = t.frames.filter((f) => !frames.includes(f));
      porTransicion = extra.length;
      frames.push(...extra);
      await runFrames(extra);
    }
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
    // Largos del guion de una historia (regla `story-fit`): una sola vez por corrida, no por cuadro.
    // Con `--scene` solo si la escena pedida es de la historia (apertura, vuelta o cierre: lo que arma `defineStory`; el contenido de un tema lo escribe cada video).
    if (rules.includes('story-fit') && (!o.scene || (await isStoryBlock(session, o.scene)))) {
      const fit = await session.storyFit();
      if (fit && !fit.ok) {
        const el = { tag: 'story', testid: o.videoId, text: '', rect: { x: 0, y: 0, w: meta.width, h: meta.height } };
        for (const message of fit.messages) findings.push({ rule: 'story-fit', severity: 'error', frame: 0, message, element: { ...el, text: 'guion de la historia' } });
      }
    }
    // Un salto lo pueden ver dos cuadros centrales (f y f+1 comparten el paso): el mismo hallazgo se repite y se queda uno. Entre saltos del mismo cuadro el orden se fija por elemento
    // (el paralelismo no puede cambiar el informe).
    const dedup = new Set<string>();
    const unique = findings.filter((f) => {
      if (f.rule !== 'salto') return true;
      const k = `${f.frame}|${f.element.path ?? ''}|${f.element.testid ?? ''}|${f.element.text}|${f.message}`;
      if (dedup.has(k)) return false;
      dedup.add(k);
      return true;
    });
    findings.length = 0;
    findings.push(...unique);
    const elKey = (f: Finding) => `${f.element.path ?? ''}|${f.element.testid ?? ''}|${f.element.text}|${f.message}`;
    findings.sort((a, b) => a.frame - b.frame || a.rule.localeCompare(b.rule) || (a.rule === 'salto' ? elKey(a).localeCompare(elKey(b)) : 0));
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
        ...(decorTexts.size ? { decor: { texts: decorTexts.size, frames: decorFrames.size } } : {}), judged, ...(o.stress ? { stress: o.stress } : {}), ...(sampling ? { sampling } : {}),
        ...(wantSalto && pairs.size ? { pares: { comparados: pairs.size, juzgados: [...pairs.values()].filter((x) => x === 'juzgado').length, cortes: [...pairs.values()].filter((x) => x === 'corte').length, porTransicion, cambios } } : {}),
        ...(fixed && !fixed.refuse ? { fixedScale: { texts: fixed.texts, frames: fixed.frames } } : {}), seconds: Math.round((Date.now() - t0) / 100) / 10,
      },
    };
    return { result, fixed };
  } finally {
    await session.close();
  }
}

/** `--scene <id|índice>` es una escena que arma la historia misma (`opening`, `interlude-N`, `interlude-reveal`, `closing`). */
async function isStoryBlock(session: Awaited<ReturnType<typeof openSession>>, scene: string): Promise<boolean> {
  const list = await session.scenes().catch(() => []);
  const sc = /^\d+$/.test(scene) ? list[Number(scene)] : list.find((x) => x.id === scene || x.name === scene);
  return !!sc && /^(opening|closing|interlude(-.+)?)$/.test(sc.id);
}

export const failsAt = (r: QaResult, level: Severity) => (level === 'warn' ? r.summary.errors + r.summary.warnings > 0 : r.summary.errors > 0);
