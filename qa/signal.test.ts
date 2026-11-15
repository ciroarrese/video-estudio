import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from './thresholds';
import { runRules } from './rules';
import { contrastRule } from './rules/contrast';
import { ALL_RULES } from './types';
import type { RuleContext, SignalMark, TextRun } from './types';
import { formatResolved, resolveThemes } from './resolved';

const rect = { x: 100, y: 100, w: 300, h: 120 };
const sig = (p: Partial<SignalMark>): SignalMark => ({ kind: 'doodle', piece: 'DoodleArrow', mark: 'arrow', forced: false, tag: 'svg', rect, ...p });
const ctx = (signals: SignalMark[]): RuleContext => ({ frame: 9, width: 1920, height: 1080, runs: [], thresholds: DEFAULT_THRESHOLDS, signals });

describe('regla signal', () => {
  it('está entre las reglas', () => {
    expect(ALL_RULES).toContain('signal');
  });
  it('avisa de un garabato de flecha o círculo y de MarkerDraw bajo un tema cuya señal no es hand', () => {
    for (const piece of ['DoodleArrow', 'DoodleCircle', 'MarkerDraw']) {
      const f = runRules(ctx([sig({ piece, kind: piece === 'MarkerDraw' ? 'marker' : 'doodle' })]), ['signal']);
      expect(f, piece).toHaveLength(1);
      expect(f[0]).toMatchObject({ rule: 'signal', severity: 'warn' });
      expect(f[0]!.message).toContain('Callout');
    }
  });
  it('con data-qa-ignore="signal" (propio o de un ancestro) el aviso baja a info y lo dice', () => {
    const f = runRules(ctx([sig({ piece: 'MarkerDraw', kind: 'marker', ignore: ['signal'] })]), ['signal']);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: 'signal', severity: 'info' });
    expect(f[0]!.message).toContain('data-qa-ignore="signal"');
    expect(runRules(ctx([sig({ piece: 'MarkerDraw', kind: 'marker', ignore: ['clip'] })]), ['signal'])[0]).toMatchObject({ severity: 'warn' });
  });
  it('no avisa si la señal del tema es hand, ni por DoodleUnderline', () => {
    expect(runRules(ctx([sig({ mark: 'hand' })]), ['signal'])).toEqual([]);
    expect(runRules(ctx([sig({ piece: 'DoodleUnderline' })]), ['signal'])).toEqual([]);
  });
  it('un Callout con variant forzada es info; uno normal, nada', () => {
    const f = runRules(ctx([sig({ kind: 'callout', piece: 'Callout', mark: 'arrow', forced: true })]), ['signal']);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ severity: 'info' });
    expect(runRules(ctx([sig({ kind: 'callout', piece: 'Callout' })]), ['signal'])).toEqual([]);
  });
  it('junta las dos mitades de un mismo Callout (trazo y rótulo) en un hallazgo', () => {
    const c = sig({ kind: 'callout', piece: 'Callout', forced: true });
    expect(runRules(ctx([c, { ...c, tag: 'div' }]), ['signal'])).toHaveLength(1);
  });
  it('sin señales (o sin el campo) no hace nada', () => {
    expect(runRules({ ...ctx([]), signals: undefined }, ['signal'])).toEqual([]);
  });
});

describe('contraste bajo un FocusGroup', () => {
  const run = (focusDim: boolean): TextRun => ({
    id: 1, key: 'k', elId: 2, chain: [2], tag: 'span', testid: null, text: 'Atenuado', rect: { x: 400, y: 400, w: 200, h: 40 }, lines: [{ x: 400, y: 400, w: 200, h: 40 }], opacity: 0.45, fontPx: 32, scale: 1,
    transformed: false, screenPx: 32, bold: false, color: 'rgba(20,20,20,1)', transparentFill: false, ignore: [], clips: [], focusDim,
    own: { sw: 200, cw: 200, sh: 40, ch: 40, ox: 'visible', oy: 'visible', ellipsis: false }, cover: null, bg: { r: 240, g: 240, b: 250, samples: 5 },
  });
  it('el contraste bajo es el efecto buscado: info, no error', () => {
    const c = { frame: 1, width: 1920, height: 1080, thresholds: DEFAULT_THRESHOLDS };
    expect(contrastRule.check({ ...c, runs: [run(false)] })[0]!.severity).toBe('error');
    const f = contrastRule.check({ ...c, runs: [run(true)] })[0]!;
    expect(f.severity).toBe('info');
    expect(f.message).toContain('FocusGroup');
  });
});

describe('--themes: qué resolvió cada sistema', () => {
  it('lista señal, salida, transición y carácter de cada uno', () => {
    const rows = resolveThemes(['neutral', 'editorial', 'papel']);
    expect(rows.map((r) => [r.theme, r.signal, r.exit])).toEqual([['neutral', 'arrow', 'dive'], ['editorial', 'bracket', 'settle'], ['papel', 'hand', 'dive']]);
    const t = formatResolved(rows);
    expect(t).toContain('editorial');
    expect(t).toContain('bracket');
    expect(t).toContain('settle');
  });
});
