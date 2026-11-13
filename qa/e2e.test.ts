// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { launchChromium } from '../render/browser';
import { QA_DEFECT_FRAMES as F } from '../examples/qa-defects/QaDefects';
import { runQa } from './run';
import { runPrivacy } from './privacy';
import { canonicalReport, diffReports } from './repeat';

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
});
