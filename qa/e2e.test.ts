// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { launchChromium } from '../render/browser';
import { QA_DEFECT_FRAMES as F } from '../examples/qa-defects/QaDefects';
import { QA_MUNDO as M } from '../examples/qa-mundo/QaMundo';
import { runQa } from './run';
import { runPrivacy } from './privacy';
import { canonicalReport, diffReports } from './repeat';
import { buildMatrix, runQaThemes } from './themes';

const chromium = await launchChromium().then(
  (b) => b.close().then(() => true),
  () => false,
);

// Needs Playwright + Chromium (skipped otherwise); compiles the runtime with vite on first use.
describe.skipIf(!chromium)('qa on the qa-defects video (e2e)', () => {
  it('reports every seeded defect with the right rule on the right frame, and nothing on the clean frame', async () => {
    const { findings, summary } = await runQa({ videoId: 'qa-defects', frames: '0-7' });
    const at = (frame: number) => findings.filter((f) => f.frame === frame);
    const only = (frame: number, rule: string, testid: string) => {
      const hit = at(frame).filter((f) => f.rule === rule);
      expect(hit, `${rule} @${frame}`).toHaveLength(1);
      expect(hit[0]!.element.testid ?? hit[0]!.other?.testid).toBeTruthy();
      expect([hit[0]!.element.testid, hit[0]!.other?.testid]).toContain(testid);
    };
    expect(at(F.clean)).toEqual([]);
    only(F.clip, 'clip', 'clip-label');
    only(F.offscreen, 'offscreen', 'offscreen-text');
    only(F.overlap, 'overlap', 'overlap-a');
    only(F.overlap, 'overlap', 'overlap-b');
    only(F.tiny, 'min-size', 'tiny-text');
    only(F.contrast, 'contrast', 'low-contrast');
    only(F.covered, 'covered', 'covered-text');
    only(F.covered, 'covered', 'covering-pill');
    // seeded frames carry no unrelated errors
    for (const [frame, rule] of [[F.clip, 'clip'], [F.offscreen, 'offscreen'], [F.overlap, 'overlap'], [F.tiny, 'min-size'], [F.contrast, 'contrast'], [F.covered, 'covered']] as const) {
      expect(at(frame).filter((f) => f.severity === 'error' && f.rule !== rule), `frame ${frame}`).toEqual([]);
    }
    expect(at(F.privacy)).toEqual([]);
    expect(summary.errors).toBe(6);
  }, 180_000);

  it('clip: a name cut by hand with a literal "…" is an error, silenced only by data-qa-ignore="clip"; an ellipsis that cuts nothing is not', async () => {
    const { findings } = await runQa({ videoId: 'qa-defects', frames: `${F.literalEllipsis},${F.literalEllipsisMarked},${F.ellipsisFits}` });
    const errs = findings.filter((f) => f.severity === 'error');
    expect(errs.map((f) => [f.frame, f.rule, f.element.testid])).toEqual([[F.literalEllipsis, 'clip', 'literal-ellipsis']]);
  }, 180_000);

  it('seeded NON-defects (wash over fading text, card flying over text, faint decorative text, text leaving while moving) give no errors', async () => {
    const { findings } = await runQa({ videoId: 'qa-defects', frames: '8-14' });
    expect(findings.filter((f) => f.severity === 'error'), JSON.stringify(findings.filter((f) => f.severity === 'error'))).toEqual([]);
    expect(findings.filter((f) => f.severity === 'warn' && f.frame >= 8)).toEqual([]);
    expect(findings.filter((f) => f.rule === 'covered').map((f) => [f.frame, f.severity])).toEqual([[8, 'info'], [9, 'info'], [10, 'info']]); // 8: el lavado a pantalla completa se informa, como info (esta a medio fundido)
    expect(findings.some((f) => f.rule === 'contrast' && f.frame === 11 && f.severity === 'info')).toBe(true);
    // the label leaving the frame is still noticed, but as info because it moves 60 px per frame
    expect(findings.filter((f) => f.rule === 'offscreen').map((f) => [f.frame, f.severity])).toEqual([[12, 'info'], [13, 'info'], [14, 'info']]);
    expect(findings.filter((f) => f.frame === 8 && f.severity !== 'info')).toEqual([]);
  }, 180_000);

  it('seeded defects the first rules missed: still faint text (contrast), a cover over one side of a line, static text fully hidden', async () => {
    const { findings } = await runQa({ videoId: 'qa-defects', frames: '15-17' });
    const errs = (frame: number) => findings.filter((f) => f.frame === frame && f.severity === 'error');
    expect(errs(F.stillFaint).map((f) => [f.rule, f.element.testid])).toEqual([['contrast', 'still-faint']]);
    expect(errs(F.sideCover).map((f) => [f.rule, f.other?.testid])).toEqual([['covered', 'side-strip']]);
    expect(errs(F.hiddenStatic).map((f) => [f.rule, f.other?.testid])).toEqual([['covered', 'hiding-card']]);
  }, 180_000);

  it('light text under a full-frame veil: a veil that crosses (opacity changing between frames) is info; the same veil held still is an error', async () => {
    const { findings } = await runQa({ videoId: 'qa-defects', frames: '19-24', rules: ['contrast'] });
    const at = (f: number) => findings.filter((x) => x.frame === f && x.rule === 'contrast');
    for (const f of [F.veilCrossA, F.veilCrossB, F.veilCrossC]) expect(at(f).map((x) => [x.element.testid, x.severity]), `frame ${f}`).toEqual([['veil-text', 'info']]);
    expect(at(F.veilCrossB)[0]!.message).toMatch(/velo de cuadro completo que cruza/);
    expect(at(F.veilStaticB).map((x) => [x.element.testid, x.severity])).toEqual([['veil-text', 'error']]);
    expect(at(F.veilStaticB)[0]!.message).toMatch(/QUIETO/);
  }, 180_000);

  it('leniencies for transitions, each with its strict counterpart (same situation but static: still an error)', async () => {
    const { findings } = await runQa({ videoId: 'qa-defects', frames: '25-54' });
    const sev = (frame: number, rule: string, testid: string) => {
      const hit = findings.filter((f) => f.frame === frame && f.rule === rule && [f.element.testid, f.other?.testid].includes(testid));
      expect(hit.length, `${rule} @${frame}`).toBeLessThanOrEqual(1);
      return hit[0]?.severity ?? null;
    };
    // fundido lento al final del easing: no hay hallazgo; el mismo texto quieto al 51 % es error
    expect(sev(F.slowFadeB, 'contrast', 'slow-fade')).toBeNull();
    expect(sev(F.slowStaticB, 'contrast', 'slow-fade')).toBe('error');
    // texto en movimiento sobre una banda oscura: info; quieto: error
    expect(sev(F.crossMoveB, 'contrast', 'cross-text')).toBe('info');
    expect(sev(F.crossStillB, 'contrast', 'cross-text')).toBe('error');
    // dos textos que se cruzan a 6 px por cuadro: info; quietos: error
    expect(sev(F.overlapMoveB, 'overlap', 'drift-a')).toBe('info');
    expect(sev(F.overlapStillB, 'overlap', 'drift-a')).toBe('error');
    // pastilla opaca que se desliza sobre un texto: info; quieta: error
    expect(sev(F.coverMoveB, 'covered', 'slow-pill')).toBe('info');
    expect(sev(F.coverStillB, 'covered', 'slow-pill')).toBe('error');
    // rebaba de 5 px bajo una camara que se mueve: info; con la camara quieta: error
    expect(sev(F.camMoveB, 'offscreen', 'sliver-text')).toBe('info');
    expect(sev(F.camStillB, 'offscreen', 'sliver-text')).toBe('error');
    // los cuadros de transicion no suman errores de otras reglas
    for (const fr of [F.slowFadeB, F.crossMoveB, F.overlapMoveB, F.coverMoveB, F.camMoveB]) expect(findings.filter((f) => f.frame === fr && f.severity === 'error'), `frame ${fr}`).toEqual([]);
  }, 180_000);

  it('min-size: un texto chico en el plano general que se lee al acercar es info (resumen con cuenta); uno que nunca se lee a tamaño legible sigue siendo error', async () => {
    const { findings, summary } = await runQa({ videoId: 'qa-defects', frames: `${F.zoomOut},${F.zoomIn},${F.neverReadable}` });
    const at = (f: number) => findings.filter((x) => x.frame === f && x.rule === 'min-size');
    // 57: 8.8 px en el plano general, 26 px en el cuadro 59 (misma escena = todo el video): detalle, info
    expect(at(F.zoomOut).map((x) => [x.severity, x.data?.detail, x.data?.count])).toEqual([['info', true, 1]]);
    expect(at(F.zoomOut)[0]!.message).toMatch(/se lee al acercar/);
    expect(at(F.zoomOut)[0]!.message).toMatch(/cuadro 59/);
    // 59: legible, sin hallazgo
    expect(at(F.zoomIn)).toEqual([]);
    // 61: el contrapunto estricto, mismo tamaño chico pero nunca legible: error
    expect(at(F.neverReadable).map((x) => [x.severity, x.element.testid])).toEqual([['error', 'never-readable']]);
    expect(summary.detailSmallText).toEqual({ texts: 1, frames: 1 });
    expect(summary.errors).toBe(1);
  }, 180_000);

  it('min-size con probeFrames=0 apaga la regla del detalle: el mismo texto chico vuelve a ser error', async () => {
    const { findings } = await runQa({ videoId: 'qa-defects', frames: `${F.zoomOut},${F.zoomIn}`, thresholds: { 'min-size': { probeFrames: 0 } } });
    expect(findings.filter((x) => x.rule === 'min-size').map((x) => [x.frame, x.severity])).toEqual([[F.zoomOut, 'error']]);
  }, 180_000);

  it('contrast juzga el texto SVG por su fill (o su trazo si no tiene relleno), no por el color CSS; covered ignora tapas invisibles', async () => {
    const { findings } = await runQa({ videoId: 'qa-defects', frames: `${F.svgFillDark},${F.svgFillPale},${F.svgStroke},${F.hiddenCovers},${F.inheritedHidden},${F.visibleCanvas}` });
    const errs = (f: number) => findings.filter((x) => x.frame === f && x.severity === 'error').map((x) => [x.rule, x.element.testid, x.other?.testid]);
    // fill oscuro con color CSS clarito (antes daba 1.01:1): sin errores
    expect(errs(F.svgFillDark)).toEqual([]);
    expect(errs(F.svgStroke)).toEqual([]);
    // contrapunto estricto: fill claro sobre fondo claro con color CSS oscuro: error de contraste
    expect(errs(F.svgFillPale)).toEqual([['contrast', 'donut-faint', undefined]]);
    // canvas con opacity 0, bloque con visibility:hidden y canvas bajo un ancestro con opacity 0: no tapan
    expect(errs(F.hiddenCovers)).toEqual([]);
    expect(errs(F.inheritedHidden)).toEqual([]);
    expect(findings.filter((x) => ([F.hiddenCovers, F.inheritedHidden] as number[]).includes(x.frame) && x.rule === 'covered')).toEqual([]);
    // contrapunto estricto: el mismo canvas visible tapa el texto
    expect(errs(F.visibleCanvas)).toEqual([['covered', 'under-visible', 'visible-canvas']]);
  }, 180_000);

  it('data-qa-decor: el adorno queda fuera de min-size y contrast (con resumen); clip, overlap contra texto normal y offscreen "main" siguen aplicando; data-qa-ignore se cuenta', async () => {
    const { findings, summary } = await runQa({ videoId: 'qa-defects', frames: `${F.decorOk},${F.decorStrict},${F.decorClip},${F.decorOverlap},${F.decorOffscreen},${F.decorMainOffscreen},${F.ignoreCounted}` });
    const errs = (f: number) => findings.filter((x) => x.frame === f && x.severity === 'error').map((x) => [x.rule, x.element.testid]).sort();
    expect(errs(F.decorOk)).toEqual([]);
    // contrapunto estricto: los mismos textos sin la marca
    expect(errs(F.decorStrict)).toEqual([['contrast', 'chrome-faint'], ['min-size', 'chrome-tiny']]);
    expect(errs(F.decorClip)).toEqual([['clip', 'chrome-clip']]);
    expect(errs(F.decorOverlap)).toEqual([['overlap', 'normal-text']]);
    expect(errs(F.decorOffscreen)).toEqual([]);
    expect(errs(F.decorMainOffscreen)).toEqual([['offscreen', 'chrome-offscreen']]);
    expect(errs(F.ignoreCounted)).toEqual([]);
    expect(summary.decor?.frames).toBe(5);
    expect(summary.silenced?.['contrast']).toEqual({ ignore: 1, decor: 1 });
    expect(summary.silenced?.['min-size']).toEqual({ ignore: 0, decor: 1 });
    expect(summary.silenced?.['offscreen']).toEqual({ ignore: 0, decor: 1 });
  }, 180_000);

  it('privacy: a term and an e-mail built from one span per letter / per part are still caught', async () => {
    const r = await runPrivacy({ videoId: 'qa-defects', frames: `${F.split}`, deny: 'Acme Corp\n' });
    expect(r.findings.map((f) => `${f.kind}:${f.value}`).sort()).toEqual(['deny-joined:acme corp', 'deny-joined:acmecorp', 'email:persona@dominio-ficticio.com']);
  }, 180_000);

  it('privacy: texts of different elements glued together do not match a term ("Supermercado" + "Pagó"); the same term in one line of spans does, as deny-joined', async () => {
    const apart = await runPrivacy({ videoId: 'qa-defects', frames: `${F.splitBlocks}`, deny: 'mercado pago\n' });
    expect(apart.findings).toEqual([]);
    const line = await runPrivacy({ videoId: 'qa-defects', frames: `${F.splitLine}`, deny: 'mercado pago\n' });
    expect(line.findings.map((f) => `${f.kind}:${f.value}`).sort()).toEqual(['deny-joined:mercado pago', 'deny-joined:mercadopago']);
  }, 180_000);

  it('privacy: e-mail and real-looking domain are caught, example.com is not; a deny term fails', async () => {
    const r = await runPrivacy({ videoId: 'qa-defects', frames: `${F.privacy}`, deny: '' });
    expect(r.ok).toBe(false);
    expect(r.findings.map((f) => `${f.kind}:${f.value}`).sort()).toEqual(['domain:www.dominio-ficticio.com', 'email:persona.ejemplo@dominio-ficticio.com']);
    const clean = await runPrivacy({ videoId: 'qa-defects', frames: `${F.clean}`, deny: '' });
    expect(clean.ok).toBe(true);
    const denied = await runPrivacy({ videoId: 'qa-defects', frames: `${F.clean}`, deny: 'tareas  # frase del cuadro 0\n' });
    expect(denied.findings.map((f) => f.kind)).toEqual(['deny']);
    const allowed = await runPrivacy({ videoId: 'qa-defects', frames: `${F.privacy}`, deny: '', allow: 'dominio-ficticio.com' });
    expect(allowed.ok).toBe(true);
  }, 180_000);


  // La ceguera: una capa de cuadro completo marcada `data-qa-ignore="covered"` (viñeta, lavado, fondo del escenario) tapaba "todos los puntos" de
  // un texto, ganaba la eleccion de la tapa y dejaba al control sin mirar el texto de abajo (hasta 114 errores reales con "0 errores" informados).
  describe('ceguera bajo una capa de cuadro completo marcada data-qa-ignore="covered"', () => {
    const sinCuadro = (fs: { frame: number }[], frame: number) => JSON.stringify(fs.filter((f) => f.frame === frame).map(({ frame: _f, ...rest }) => rest));

    it('la viñeta no cambia NINGUN hallazgo: contraste, rotulos que se pisan y rotulo bajo una pastilla dan lo mismo con y sin ella (mensaje, medidas y cajas incluidos)', async () => {
      const { findings, summary } = await runQa({ videoId: 'qa-defects', frames: '76-84,92' });
      for (const [sin, con, rule] of [[F.vigContrastA, F.vigContrastB, 'contrast'], [F.vigOverlapA, F.vigOverlapB, 'overlap'], [F.vigCoveredA, F.vigCoveredB, 'covered']] as const) {
        const a = findings.filter((f) => f.frame === sin);
        expect(a.map((f) => [f.rule, f.severity]), `cuadro ${sin}`).toEqual([[rule, 'error']]);
        expect(sinCuadro(findings, con), `cuadro ${con} contra ${sin}`).toBe(sinCuadro(findings, sin));
      }
      // la viñeta que cambia de opacidad sobre un texto quieto no es un velo que cruza: error en los tres cuadros
      for (const fr of [F.vigFadeA, F.vigFadeB, F.vigFadeC]) expect(findings.filter((f) => f.frame === fr).map((f) => [f.rule, f.severity, f.element.testid]), `cuadro ${fr}`).toEqual([['contrast', 'error', 'vig-fade-text']]);
      // un degradado de cuadro completo con el centro transparente, sin marca, tampoco tapa
      expect(findings.filter((f) => f.frame === F.gradientOverlap).map((f) => [f.rule, f.severity])).toEqual([['overlap', 'error']]);
      expect(findings.filter((f) => f.rule === 'unjudged')).toEqual([]);
      expect(summary.judged.unjudgedVisible).toBe(0);
    }, 180_000);

    it('un lavado liso marcado a medio fundido es info (documentado); el mismo lavado quieto es error; cerrado del todo, lo de abajo no se ve y no hay hallazgos', async () => {
      const { findings, summary } = await runQa({ videoId: 'qa-defects', frames: '85-91' });
      const sev = (fr: number) => findings.filter((f) => f.frame === fr && f.rule === 'contrast').map((f) => f.severity);
      for (const fr of [F.washCrossA, F.washCrossB, F.washCrossC]) expect(sev(fr), `cuadro ${fr}`).toEqual(['info']);
      expect(sev(F.washStillB)).toEqual(['error']);
      expect(findings.filter((f) => f.frame === F.washClosed)).toEqual([]);
      // el resumen cuenta lo que no se juzgo y por que: los cuatro textos del cuadro 91 (el titulo y tres) quedan tapados por el lavado cerrado
      expect(summary.judged.notJudged.hidden).toBe(4);
      expect(summary.judged.coverMarkerSkipped).toBeGreaterThanOrEqual(4);
      expect(summary.judged.judged + summary.judged.notJudged.total).toBe(summary.judged.texts);
    }, 180_000);

    it('el velo que no termina de cerrarse (0,985) tapa el texto de abajo: se cuenta como tapado, no da `contrast`; a 0,86 / 0,94 / 0,97 sigue siendo un velo que cruza (info)', async () => {
      const { findings, summary } = await runQa({ videoId: 'qa-defects', frames: '99-102' });
      expect(findings.filter((f) => f.frame === F.veilNearClosed)).toEqual([]);
      expect(summary.judged.notJudged.hidden).toBeGreaterThanOrEqual(1);
      const c = (fr: number) => findings.filter((f) => f.frame === fr && f.rule === 'contrast').map((f) => [f.element.testid, f.severity]);
      expect(c(F.veilNearB)).toEqual([['near-text', 'info']]);
      expect(findings.filter((f) => f.severity === 'error')).toEqual([]);
    }, 180_000);

    it('el resumen dice cuanto texto se juzgo (nada ciego): en el cuadro limpio se juzgan todos', async () => {
      const { summary } = await runQa({ videoId: 'qa-defects', frames: '0' });
      expect(summary.judged.texts).toBe(4);
      expect(summary.judged.judged).toBe(4);
      expect(summary.judged.notJudged.total).toBe(0);
    }, 180_000);
  });

  it('vacio (aviso, solo vertical y cuadrado): un hueco grande entre elementos o debajo de lo que está pegado arriba avisa; centrado, con un velo, o cruzado por una franja que cuenta, no; una franja marcada data-qa-ignore="vacio" no cuenta', async () => {
    for (const format of ['vertical', 'cuadrado'] as const) {
      const { findings } = await runQa({ videoId: 'qa-defects', format, frames: '103-120', rules: ['vacio'] });
      const at = (fr: number) => findings.filter((f) => f.frame === fr).map((f) => [f.rule, f.severity, f.element.text]);
      expect(at(F.vacioMedioB), `${format} medio`).toEqual([['vacio', 'warn', 'franja vacía en el medio']]);
      expect(at(F.vacioCentradoB), `${format} centrado`).toEqual([]);
      expect(at(F.vacioAbajoB), `${format} abajo`).toEqual([['vacio', 'warn', 'franja vacía abajo']]);
      expect(at(F.vacioVeloB), `${format} velo`).toEqual([]);
      expect(at(F.vacioFranjaB), `${format} franja que cuenta`).toEqual([]);
      expect(at(F.vacioFranjaMarcadaB), `${format} franja marcada`).toEqual([['vacio', 'warn', 'franja vacía en el medio']]);
      expect(findings.every((f) => f.severity === 'warn')).toBe(true);
    }
    // en horizontal no corre
    const h = await runQa({ videoId: 'qa-defects', frames: '103-120', rules: ['vacio'] });
    expect(h.findings).toEqual([]);
  }, 300_000);

  it('texto-chico (aviso): un texto de 12,8 px quieto avisa; el mismo texto desplazándose, o de adorno, no', async () => {
    const { findings } = await runQa({ videoId: 'qa-defects', frames: '121-129', rules: ['texto-chico'] });
    const at = (fr: number) => findings.filter((f) => f.frame === fr).map((f) => [f.rule, f.severity, f.element.testid]);
    expect(at(F.chicoB)).toEqual([['texto-chico', 'warn', 'chico-text']]);
    expect(at(F.chicoMueveB)).toEqual([]);
    expect(at(F.chicoAdornoB)).toEqual([]);
  }, 180_000);

  it('--themes: el mismo control bajo cada sistema, con matriz; un video que no lee props.theme da lo mismo en todos', async () => {
    const reports = await runQaThemes({ videoId: 'qa-defects', frames: '3,5' }, ['neutral', 'dark', 'neon']);
    const m = buildMatrix(reports);
    expect(m.themes).toEqual(['neutral', 'dark', 'neon']);
    expect(m.differences).toEqual([]);
    expect(m.cells['dark']!.errors).toBe(m.cells['neutral']!.errors);
  }, 300_000);

  it('estres de tipografia: --font-scale agranda la letra (el texto de 10 px deja de ser error) y --font-fallback cambia las medidas', async () => {
    const base = await runQa({ videoId: 'qa-defects', frames: `${F.tiny},${F.overlap}` });
    expect(base.findings.filter((f) => f.frame === F.tiny && f.rule === 'min-size' && f.severity === 'error')).toHaveLength(1);
    const big = await runQa({ videoId: 'qa-defects', frames: `${F.tiny}`, stress: { fontScale: 2 } });
    expect(big.findings.filter((f) => f.rule === 'min-size' && f.severity === 'error')).toEqual([]);
    expect(big.summary.stress).toEqual({ fontScale: 2 });
    const wide = await runQa({ videoId: 'qa-defects', frames: `${F.overlap}`, stress: { fontFallback: 'wide' } });
    const w = (r: typeof base, fr: number) => r.findings.find((f) => f.frame === fr && f.rule === 'overlap')?.element.rect.w;
    expect(w(wide, F.overlap)).toBeGreaterThan(w(base, F.overlap)!);
  }, 300_000);

  it('story-fit sola no muestrea cuadros (solo el largo del guion) y con --scene también corre si la escena es de la historia', async () => {
    for (const scene of [undefined, 'opening', 'closing']) {
      const r = await runQa({ videoId: 'story-demo', rules: ['story-fit'], scene });
      expect(r.summary.frames, String(scene)).toEqual([]);
      expect(r.summary.errors, String(scene)).toBe(0);
    }
  }, 300_000);

  // Reproducibilidad: el control es una función determinista del video y las opciones. Antes el muestreo de fondos corría en el canvas de
  // la página y devolvía colores distintos para el mismo PNG: el contraste saltaba entre corridas (fx-in-scene con neon, cuadros 184/192/222).
  it('reproducible: dos corridas del mismo control dan informes idénticos (hallazgos y medidas), con paralelismo y con vecinos', async () => {
    const a = await runQa({ videoId: 'qa-defects', frames: '0-24', concurrency: 3 });
    const b = await runQa({ videoId: 'qa-defects', frames: '0-24', concurrency: 3 });
    expect(diffReports(a, b)).toEqual([]);
    expect(canonicalReport(a)).toBe(canonicalReport(b));
    const o = { videoId: 'fx-in-scene', props: { theme: 'neon' }, frames: [169, 184, 192, 222, 253], concurrency: 3 };
    const c = await runQa(o);
    const d = await runQa(o);
    expect(diffReports(c, d)).toEqual([]);
  }, 300_000);

  // Interfaz recreada bajo una cámara (`data-qa-world`, `-overlay`, `-target`, `-settled`): cada caso de `qa-mundo` ocupa tres cuadros y se mira el del medio.
  it('qa-mundo: zoom, capas fijas, objetivo, texto-chico y foco centrado (cada excepción con su contrapunto estricto)', async () => {
    const { findings, summary } = await runQa({ videoId: 'qa-mundo', frames: Object.values(M), perScene: 0, pares: 0 });
    const at = (fr: number, ...rules: string[]) => findings.filter((f) => f.frame === fr && (!rules.length || rules.includes(f.rule))).map((f) => `${f.rule}:${f.severity}`).sort();
    expect(at(M.zoomCut, 'offscreen')).toEqual(['offscreen:info']); // el borde corta la interfaz acercada: info
    expect(at(M.zoomCut).filter((x) => x.endsWith(':error'))).toEqual([]);
    expect(at(M.zoomOne, 'offscreen')).toEqual(['offscreen:error']); // el mismo corte a escala 1: error
    expect(at(M.targetCut, 'offscreen')).toEqual(['offscreen:error']); // el objetivo cortado nunca se exceptua
    expect(at(M.coveredCut, 'covered', 'offscreen')).toEqual(['covered:info', 'offscreen:info']);
    expect(at(M.coveredWhole, 'covered')).toEqual(['covered:error']);
    expect(at(M.targetCovered, 'covered')).toEqual(['covered:error']);
    expect(at(M.overlayOverWorld)).toEqual([]); // la capa fija no cuenta como tapa del mundo
    expect(at(M.overlayOverTarget, 'covered')).toEqual(['covered:error']); // salvo sobre el objetivo
    expect(at(M.overlayClip, 'clip')).toEqual(['clip:error']); // el texto propio de la capa se juzga entero
    expect(at(M.overlayContrast, 'contrast')).toEqual(['contrast:info']);
    expect(at(M.contrastNoMark, 'contrast')).toEqual(['contrast:error']);
    expect(at(M.chicoOther, 'texto-chico')).toEqual([]);
    expect(at(M.chicoTarget, 'texto-chico')).toEqual(['texto-chico:warn']);
    expect(at(M.chicoUnsettled, 'texto-chico')).toEqual([]);
    expect(at(M.saltoJump, 'salto')).toEqual(['salto:warn']);
    for (const n of ['saltoContinuous', 'saltoCamera', 'saltoEntry', 'overlayGlued'] as const) expect(at(M[n], 'salto'), n).toEqual([]);
    expect(at(M.sideFlip, 'salto')).toEqual(['salto:warn', 'salto:warn']); // el salto y el cambio de lado
    expect(findings.find((f) => f.frame === M.sideFlip && f.message.includes('cambia de lado'))).toBeTruthy();
    expect(at(M.overlayJump, 'salto')).toEqual(['salto:warn']);
    expect(at(M.focoCenter, 'foco-centro')).toEqual([]);
    expect(at(M.foco70, 'foco-centro')).toEqual(['foco-centro:warn']);
    expect(at(M.foco95, 'foco-centro')).toEqual(['foco-centro:error']);
    expect(at(M.focoTraveling, 'foco-centro')).toEqual([]);
    expect(at(M.focoOutside, 'foco-centro')).toEqual(['foco-centro:error']);
    // lo que baja a info por el borde y lo que no cuenta como tapa se nombra en el resumen
    expect(summary.judged.partial.worldText).toBeGreaterThan(0);
    expect(summary.judged.partial.worldCut).toBeGreaterThan(0);
    expect(summary.judged.overlayCoverSkipped).toBeGreaterThan(0);
    expect(summary.pares?.juzgados).toBeGreaterThan(0);
  }, 300_000);

  it('qa-mundo: los pares alrededor de los cambios de data-qa-settled/data-qa-target se suman solos (acotados por --pares) y el informe es reproducible', async () => {
    const base = { videoId: 'qa-mundo', count: 6, perScene: 0 };
    const none = await runQa({ ...base, pares: 0 });
    expect(none.summary.pares?.porTransicion ?? 0).toBe(0);
    const auto = await runQa(base);
    expect(auto.summary.pares!.cambios).toBeGreaterThan(5); // cada caso cambia el objetivo o el asentado
    expect(auto.summary.pares!.porTransicion).toBeGreaterThan(0);
    expect(auto.summary.frames.length).toBeGreaterThan(none.summary.frames.length);
    const few = await runQa({ ...base, pares: 3 });
    expect(few.summary.pares!.porTransicion).toBeLessThanOrEqual(3);
    expect(diffReports(auto, await runQa(base))).toEqual([]);
  }, 400_000);

  it('un video sin marcas no usa salto ni foco-centro: ni pares en el resumen ni hallazgos de esas reglas', async () => {
    const r = await runQa({ videoId: 'qa-defects', frames: '0-24' });
    expect(r.summary.pares).toBeUndefined();
    expect(r.findings.filter((f) => f.rule === 'salto' || f.rule === 'foco-centro')).toEqual([]);
    expect(r.summary.judged.partial).toEqual({ decor: expect.any(Number), veil: expect.any(Number), ignoredSome: expect.any(Number), gradientText: expect.any(Number) });
  }, 180_000);
});
