// @vitest-environment node
// Estres de tipografia: la escala no se compone de un cuadro al siguiente, es reproducible y respeta `data-qa-fixed-scale`.
import { describe, expect, it } from 'vitest';
import { launchChromium } from '../render/browser';
import { QA_DEFECT_FRAMES as F } from '../examples/qa-defects/QaDefects';
import { runQa } from './run';
import { canonicalReport, diffReports } from './repeat';
import { openSession } from './session';

const chromium = await launchChromium().then(
  (b) => b.close().then(() => true),
  () => false,
);

const sizes = (page: { evaluate: unknown }, sel: string) =>
  (page.evaluate as (f: (s: string) => unknown, a: string) => Promise<unknown>)(
    (s: string) => Array.from(document.querySelectorAll(s)).map((e) => getComputedStyle(e).fontSize),
    sel,
  ) as Promise<string[]>;

describe.skipIf(!chromium)('estres de tipografia (e2e)', () => {
  it('--font-scale no se compone: el mismo cuadro medido tras 1 y tras 10 cuadros previos tiene la misma letra', async () => {
    const session = await openSession({ videoId: 'qa-defects', stress: { fontScale: 1.25 } });
    try {
      // el titulo mide 44 px: 44 x 1.25 = 55 (entero), el caso en que la escala se componia
      const a = await session.openPage();
      await a.setFrame(0);
      const una = await sizes(a.page, '[data-testid="heading"], [data-testid="clean-value"]');
      const b = await session.openPage();
      for (let f = 0; f < 10; f++) await b.setFrame(f);
      await b.setFrame(0);
      const diez = await sizes(b.page, '[data-testid="heading"], [data-testid="clean-value"]');
      expect(una).toEqual(['55px', '90px']);
      expect(diez).toEqual(una);
      // y el mismo cuadro repetido muchas veces seguidas
      for (let i = 0; i < 10; i++) await b.setFrame(0);
      expect(await sizes(b.page, '[data-testid="heading"]')).toEqual(['55px']);
    } finally {
      await session.close();
    }
  }, 300_000);

  it('--repeat 2 con estres: dos corridas dan informes identicos', async () => {
    const o = { videoId: 'qa-defects', frames: '0-8', concurrency: 3, stress: { fontScale: 1.25, fontFallback: 'wide' as const } };
    const a = await runQa(o);
    const b = await runQa(o);
    expect(diffReports(a, b)).toEqual([]);
    expect(canonicalReport(a)).toBe(canonicalReport(b));
  }, 300_000);

  it('data-qa-fixed-scale: exime del estres (con la cuenta), el contrapunto sin marca da clip y la marca sobre el escenario entero se rechaza', async () => {
    const stress = { fontScale: 1.25 };
    const clips = (r: Awaited<ReturnType<typeof runQa>>) => r.findings.filter((f) => f.rule === 'clip' && f.severity === 'error');
    // sin estres los tres cuadros estan limpios
    const base = await runQa({ videoId: 'qa-defects', frames: `${F.fixedOk},${F.fixedStrict},${F.fixedWhole}` });
    expect(base.findings.filter((f) => f.severity !== 'info')).toEqual([]);
    expect(base.summary.fixedScale).toBeUndefined();
    const ok = await runQa({ videoId: 'qa-defects', frames: `${F.fixedOk}`, stress });
    expect(clips(ok)).toEqual([]);
    expect(ok.summary.fixedScale).toEqual({ texts: 1, frames: 1 });
    const strict = await runQa({ videoId: 'qa-defects', frames: `${F.fixedStrict}`, stress });
    expect(clips(strict)).toHaveLength(1);
    expect(strict.summary.fixedScale).toBeUndefined();
    const whole = await runQa({ videoId: 'qa-defects', frames: `${F.fixedWhole}`, stress });
    expect(whole.summary.fixedScale).toEqual({ texts: 1, frames: 1, refused: true });
    expect(clips(whole)).toHaveLength(1);
    // con otro texto fuera de la marca en algun cuadro, la misma marca de cuadro completo no se rechaza
    const mixed = await runQa({ videoId: 'qa-defects', frames: `${F.fixedWhole},0`, stress });
    expect(mixed.summary.fixedScale?.refused).toBeUndefined();
    expect(clips(mixed)).toEqual([]);
  }, 300_000);
});
