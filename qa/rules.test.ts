import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, mergeThresholds, parseOverrides } from './thresholds';
import { classifyContrast, contrastRule, isLargeText } from './rules/contrast';
import { runRules } from './rules';
import type { Rect, RuleContext, TextRun } from './types';

const W = 1920;
const H = 1080;
let next = 0;
function run(p: Partial<TextRun> & { rect?: Rect }): TextRun {
  const id = next++;
  const rect = p.rect ?? { x: 400, y: 400, w: 300, h: 40 };
  return {
    id, key: `k${id}`, elId: id + 1, chain: [id + 1], tag: 'div', testid: `t${id}`, text: 'Texto', rect, lines: [rect], opacity: 1, fontPx: 32, scale: 1,
    transformed: false, screenPx: 32, bold: false, color: 'rgba(20,20,20,1)', transparentFill: false, ignore: [], clips: [],
    own: { sw: 300, cw: 300, sh: 40, ch: 40, ox: 'visible', oy: 'visible', ellipsis: false }, cover: null, ...p,
  };
}
const check = (runs: TextRun[], rules?: Parameters<typeof runRules>[1], thresholds = DEFAULT_THRESHOLDS) =>
  runRules({ frame: 7, width: W, height: H, runs, thresholds } as RuleContext, rules);

describe('contrast classification', () => {
  it('error < 3, warn < 4.5 for small text only', () => {
    const t = DEFAULT_THRESHOLDS.contrast;
    expect(classifyContrast(2.9, false, t)).toBe('error');
    expect(classifyContrast(2.9, true, t)).toBe('error');
    expect(classifyContrast(4, false, t)).toBe('warn');
    expect(classifyContrast(4, true, t)).toBeNull();
    expect(classifyContrast(7, false, t)).toBeNull();
  });
  it('large text scales with the frame height', () => {
    const t = DEFAULT_THRESHOLDS.contrast;
    expect(isLargeText(24, false, 1080, t)).toBe(true);
    expect(isLargeText(23, false, 1080, t)).toBe(false);
    expect(isLargeText(19, true, 1080, t)).toBe(true);
    expect(isLargeText(16, false, 720, t)).toBe(true);
  });
  it('rule uses the sampled background, text opacity and skips gradient text', () => {
    const grey = run({ color: 'rgba(210,210,210,1)', bg: { r: 242, g: 242, b: 242, samples: 9 } });
    const fine = run({ bg: { r: 255, g: 255, b: 255, samples: 9 } });
    const gradient = run({ color: 'rgba(0,0,0,0)', transparentFill: true, bg: { r: 0, g: 0, b: 0, samples: 1 } });
    const fading = run({ color: 'rgba(210,210,210,1)', opacity: 0.02, bg: { r: 242, g: 242, b: 242, samples: 9 } });
    const f = contrastRule.check({ frame: 1, width: W, height: H, runs: [grey, fine, gradient, fading], thresholds: DEFAULT_THRESHOLDS });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: 'contrast', severity: 'error' });
    expect(f[0]!.element.testid).toBe(grey.testid);
  });
});

describe('rules on plain data', () => {
  it('clip: own ellipsis overflow, ancestor clipping, fully hidden is exempt, data-qa-ignore', () => {
    const own = run({ own: { sw: 400, cw: 170, sh: 30, ch: 30, ox: 'hidden', oy: 'visible', ellipsis: true } });
    const box = { id: 99, tag: 'div', testid: 'box', rect: { x: 400, y: 400, w: 200, h: 100 }, ox: true, oy: true };
    const cut = run({ chain: [5, 99], clips: [box], rect: { x: 500, y: 420, w: 300, h: 30 } });
    const gone = run({ chain: [6, 99], clips: [box], rect: { x: 700, y: 420, w: 100, h: 30 } });
    const silenced = run({ chain: [7, 99], clips: [box], rect: { x: 500, y: 460, w: 300, h: 30 }, ignore: ['clip'] });
    const f = check([own, cut, gone, silenced], ['clip']);
    expect(f.map((x) => x.element.testid)).toEqual([own.testid, cut.testid]);
  });
  it('clip: a box as big as the frame, or a cut that is the frame edge, is not a clip', () => {
    const stageBox = { id: 1, tag: 'div', testid: null, rect: { x: 0, y: 0, w: W, h: H }, ox: true, oy: true };
    const r = run({ clips: [stageBox], rect: { x: W - 50, y: 100, w: 200, h: 30 } });
    expect(check([r], ['clip'])).toEqual([]);
  });
  it('offscreen: partial is an error (warn under a camera), fully outside / transparent / huge are exempt', () => {
    const partial = run({ rect: { x: W - 100, y: 300, w: 300, h: 40 } });
    const cam = run({ rect: { x: -50, y: 300, w: 300, h: 40 }, transformed: true });
    const slip = run({ rect: { x: -8, y: 300, w: 300, h: 40 }, transformed: true });
    const outside = run({ rect: { x: W + 10, y: 300, w: 300, h: 40 } });
    const ghost = run({ rect: { x: W - 100, y: 300, w: 300, h: 40 }, opacity: 0.01 });
    const huge = run({ rect: { x: -9000, y: -3000, w: 30000, h: 9000 } });
    const f = check([partial, cam, slip, outside, ghost, huge], ['offscreen']);
    expect(f.map((x) => [x.element.testid, x.severity])).toEqual([[partial.testid, 'error'], [cam.testid, 'warn'], [slip.testid, 'error']]);
  });
  it('safe-area: warns inside the frame but outside the margins; offscreen text is left to the other rule', () => {
    const edge = run({ rect: { x: 20, y: 300, w: 300, h: 40 } });
    const ok = run({ rect: { x: 100, y: 300, w: 300, h: 40 } });
    const off = run({ rect: { x: -20, y: 300, w: 300, h: 40 } });
    const f = check([edge, ok, off], ['safe-area']);
    expect(f.map((x) => x.element.testid)).toEqual([edge.testid]);
    expect(f[0]!.severity).toBe('warn');
    expect(check([edge], ['safe-area'], mergeThresholds({ 'safe-area': { margin: 0.01 } }))).toEqual([]);
  });
  it('overlap: unrelated elements over the threshold; ancestors, faint text and near misses are ignored', () => {
    const a = run({ rect: { x: 100, y: 100, w: 400, h: 60 }, elId: 1, chain: [1] });
    const b = run({ rect: { x: 140, y: 120, w: 400, h: 60 }, elId: 2, chain: [2] });
    const child = run({ rect: { x: 100, y: 100, w: 400, h: 60 }, elId: 3, chain: [3, 1] });
    const faint = run({ rect: { x: 100, y: 100, w: 400, h: 60 }, elId: 4, chain: [4], opacity: 0.1 });
    const near = run({ rect: { x: 100, y: 170, w: 400, h: 60 }, elId: 5, chain: [5] });
    expect(check([a, child], ['overlap'])).toEqual([]);
    const f = check([a, b, faint, near], ['overlap']);
    expect(f).toHaveLength(1);
    expect([f[0]!.element.testid, f[0]!.other!.testid].sort()).toEqual([a.testid, b.testid].sort());
    expect(check([a, b], ['overlap'], mergeThresholds({ overlap: { ratio: 0.95 } }))).toEqual([]);
  });
  it('min-size: uses the on-screen size and scales with frame height', () => {
    const small = run({ screenPx: 12 });
    const zoomed = run({ fontPx: 12, scale: 2, screenPx: 24 });
    expect(check([small, zoomed], ['min-size']).map((x) => x.element.testid)).toEqual([small.testid]);
    const f720 = runRules({ frame: 0, width: 1280, height: 720, runs: [run({ screenPx: 12.2 })], thresholds: DEFAULT_THRESHOLDS }, ['min-size']);
    expect(f720).toEqual([]);
  });
  it('min-size: text under 0.35 effective opacity (mid-fade, decorative) is info, not an error', () => {
    const faint = run({ screenPx: 12, opacity: 0.2 });
    const solid = run({ screenPx: 12, opacity: 0.8 });
    expect(check([faint, solid], ['min-size']).map((x) => [x.element.testid, x.severity])).toEqual([[faint.testid, 'info'], [solid.testid, 'error']]);
  });
  it('covered: reports the covering element, honours ignore on either side', () => {
    const cover = { id: 9, key: 'c', tag: 'div', testid: 'pill', text: '', rect: { x: 1, y: 2, w: 3, h: 4 }, ignore: [] as string[] };
    const a = run({ cover });
    const b = run({ cover: { ...cover, ignore: ['covered'] } });
    const f = check([a, b, run({})], ['covered']);
    expect(f).toHaveLength(1);
    expect(f[0]!.other!.testid).toBe('pill');
  });
  it('covered: one finding per coverer; scene washes, faint text and moving elements are not errors', () => {
    const cover = { id: 9, key: 'c', tag: 'div', testid: 'pill', text: '', rect: { x: 100, y: 100, w: 300, h: 100 }, ignore: [] as string[] };
    const a = run({ cover });
    const b = run({ cover });
    const f = check([a, b], ['covered']);
    expect(f).toHaveLength(1);
    expect(f[0]!.data).toMatchObject({ covered: 2 });
    const wash = { ...cover, id: 10, rect: { x: 0, y: 0, w: W, h: H } };
    expect(check([run({ cover: wash, opacity: 0.1 })], ['covered'])).toEqual([]);
    expect(check([run({ cover, opacity: 0.1 })], ['covered'])).toEqual([]);
    expect(check([run({ cover: { ...cover, motion: 60 } })], ['covered'])[0]!.severity).toBe('info');
    expect(check([run({ cover, motion: 60 })], ['covered'])[0]!.severity).toBe('info');
  });
  it('covered: text hidden entirely by a static card is an error (only motion downgrades it); moving is info', () => {
    const t = { x: 400, y: 400, w: 300, h: 40 };
    const card = { id: 9, key: 'c', tag: 'div', testid: 'card', text: '', rect: { x: 380, y: 380, w: 400, h: 100 }, ignore: [] as string[] };
    expect(check([run({ cover: card, rect: t })], ['covered'])[0]!.severity).toBe('error');
    expect(check([run({ cover: card, rect: t, motion: 40 })], ['covered'])[0]!.severity).toBe('info');
    expect(check([run({ cover: { ...card, motion: 40 }, rect: t })], ['covered'])[0]!.severity).toBe('info');
    expect(check([run({ cover: { ...card, rect: { x: 500, y: 380, w: 400, h: 100 } }, rect: t })], ['covered'])[0]!.severity).toBe('error');
  });
  it('covered: a partial cover (40% of the line, centre free) is reported with its share', () => {
    const cover = { id: 9, key: 'c', tag: 'div', testid: 'strip', text: '', rect: { x: 400, y: 390, w: 120, h: 60 }, ignore: [] as string[], frac: 0.4 };
    const f = check([run({ cover })], ['covered']);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ severity: 'error' });
    expect(f[0]!.message).toMatch(/40%/);
  });
  it('covered: text under a full-frame opaque layer is reported (warn; info if moving), not silently dropped; the other rules still skip it', () => {
    const layer = { id: 10, key: 'l', opacity: 1, tag: 'div', testid: 'end-card', text: '', rect: { x: 0, y: 0, w: W, h: H }, ignore: [] as string[] };
    const a = run({ cover: layer, rect: { x: 100, y: 100, w: 300, h: 40 }, screenPx: 9 });
    const b = run({ cover: layer, rect: { x: 120, y: 105, w: 300, h: 40 } });
    expect(check([a, b], ['overlap', 'min-size'])).toEqual([]);
    const f = check([a, b], ['overlap', 'min-size', 'covered']);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: 'covered', severity: 'warn' });
    expect(f[0]!.message).toMatch(/cuadro completo/);
    expect(check([run({ cover: { ...layer, motion: 80 } })], ['covered'])[0]!.severity).toBe('info');
    expect(check([run({ cover: { ...layer, opacity: 0.95 } })], ['covered'])[0]!.severity).toBe('info'); // lavado a medio fundido
    expect(check([run({ cover: layer, opacity: 0.1 })], ['covered'])).toEqual([]); // fundido: no cuenta
    expect(check([run({ cover: { ...layer, ignore: ['covered'] } })], ['covered'])).toEqual([]);
  });
  it('motion downgrades offscreen and overlap to info', () => {
    const o = run({ rect: { x: W - 100, y: 300, w: 300, h: 40 }, motion: 30 });
    expect(check([o], ['offscreen'])[0]!.severity).toBe('info');
    const a = run({ rect: { x: 100, y: 100, w: 400, h: 60 }, elId: 1, chain: [1], motion: 30 });
    const b = run({ rect: { x: 140, y: 120, w: 400, h: 60 }, elId: 2, chain: [2] });
    expect(check([a, b], ['overlap'])[0]!.severity).toBe('info');
  });
  it('contrast: faint or not-yet-settled text is downgraded', () => {
    const base = { color: 'rgba(210,210,210,1)', bg: { r: 242, g: 242, b: 242, samples: 9 } };
    const sev = (opacity: number) => contrastRule.check({ frame: 0, width: W, height: H, runs: [run({ ...base, opacity })], thresholds: DEFAULT_THRESHOLDS })[0]?.severity;
    expect(sev(1)).toBe('error');
    expect(sev(0.6)).toBe('error');
    expect(sev(0.2)).toBe('info');
  });
  it('contrast: static text is judged at its composited opacity; text mid-fade or moving by its own colour', () => {
    // #6b6b6b sobre blanco = 5.3:1 opaco, pero al 50% se dibuja como ~#b5b5b5 (2.1:1)
    const base = { color: 'rgba(107,107,107,1)', bg: { r: 255, g: 255, b: 255, samples: 9 }, opacity: 0.5 };
    const sev = (extra: Partial<TextRun>) => contrastRule.check({ frame: 0, width: W, height: H, runs: [run({ ...base, ...extra })], thresholds: DEFAULT_THRESHOLDS })[0]?.severity;
    expect(sev({ motion: 0, fade: 0 })).toBe('error');
    expect(sev({})).toBe('error'); // sin vecinos medidos: cuenta como quieto
    expect(sev({ fade: 0.3 })).toBeUndefined(); // a mitad de un fundido: un cuadro asentado lo mostraria opaco
    expect(sev({ motion: 40 })).toBeUndefined();
    expect(sev({ opacity: 1 })).toBeUndefined();
  });
});

describe('thresholds', () => {
  it('merges overrides and rejects unknown ones', () => {
    expect(mergeThresholds({ overlap: { ratio: 0.5 } }).overlap.ratio).toBe(0.5);
    expect(mergeThresholds().overlap.ratio).toBe(0.2);
    expect(() => mergeThresholds({ overlap: { nope: 1 } as never })).toThrow(/desconocido/);
  });
  it('parses --set assignments', () => {
    expect(parseOverrides(['overlap.ratio=0.3', 'min-size.minPx1080=20'])).toEqual({ overlap: { ratio: 0.3 }, 'min-size': { minPx1080: 20 } });
    expect(() => parseOverrides(['bad'])).toThrow();
  });
});
