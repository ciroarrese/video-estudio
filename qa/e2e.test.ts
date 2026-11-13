// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { launchChromium } from '../render/browser';
import { QA_DEFECT_FRAMES as F } from '../examples/qa-defects/QaDefects';
import { runQa } from './run';
import { runPrivacy } from './privacy';

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
    expect(findings.filter((f) => f.rule === 'covered').map((f) => [f.frame, f.severity])).toEqual([[9, 'info'], [10, 'info']]);
    expect(findings.some((f) => f.rule === 'contrast' && f.frame === 11 && f.severity === 'info')).toBe(true);
    // the label leaving the frame is still noticed, but as info because it moves 60 px per frame
    expect(findings.filter((f) => f.rule === 'offscreen').map((f) => [f.frame, f.severity])).toEqual([[12, 'info'], [13, 'info'], [14, 'info']]);
    expect(findings.filter((f) => f.frame === 8 && f.severity !== 'info')).toEqual([]);
  }, 180_000);

  it('privacy: e-mail and real-looking domain are caught, example.com is not; a deny term fails', async () => {
    const r = await runPrivacy({ videoId: 'qa-defects', frames: `${F.privacy}`, deny: '' });
    expect(r.ok).toBe(false);
    expect(r.findings.map((f) => `${f.kind}:${f.value}`).sort()).toEqual(['domain:www.lumbrera-datos.com', 'email:lucia.paredes@lumbrera-datos.com']);
    const clean = await runPrivacy({ videoId: 'qa-defects', frames: `${F.clean}`, deny: '' });
    expect(clean.ok).toBe(true);
    const denied = await runPrivacy({ videoId: 'qa-defects', frames: `${F.clean}`, deny: 'tareas  # frase del cuadro 0\n' });
    expect(denied.findings.map((f) => f.kind)).toEqual(['deny']);
    const allowed = await runPrivacy({ videoId: 'qa-defects', frames: `${F.privacy}`, deny: '', allow: 'lumbrera-datos.com' });
    expect(allowed.ok).toBe(true);
  }, 180_000);
});
