import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from './thresholds';
import { runRules } from './rules';
import { addJudged, emptyJudged, judgement } from './rules/judged';
import { edgeCut } from './world';
import type { AnchorInfo, Rect, RuleContext, TextRun, WorldInfo } from './types';

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
const inWorld = (p: Partial<TextRun> & { rect?: Rect } = {}, zoom = 2, settled = false) => run({ transformed: zoom !== 1, scale: zoom, world: { key: 'w', zoom, settled }, ...p });
const cutRect: Rect = { x: 1800, y: 400, w: 300, h: 40 }; // sobresale 180 px del borde derecho
const check = (runs: TextRun[], rules: Parameters<typeof runRules>[1], extra: Partial<RuleContext> = {}) =>
  runRules({ frame: 7, width: W, height: H, runs, thresholds: DEFAULT_THRESHOLDS, ...extra } as RuleContext, rules);
const sev = (fs: { severity: string }[]) => fs.map((f) => f.severity);

describe('data-qa-world: el borde del cuadro corta la interfaz con el mundo acercado', () => {
  it('offscreen: con el mundo acercado el texto cortado baja a info y la línea dice por qué; a escala 1 es error; fuera de un mundo es error', () => {
    const zoomed = inWorld({ rect: cutRect });
    const flat = inWorld({ rect: cutRect }, 1);
    const plain = run({ rect: cutRect });
    expect(check([zoomed], ['offscreen'])).toMatchObject([{ severity: 'info', message: expect.stringContaining('data-qa-world') }]);
    expect(sev(check([flat], ['offscreen']))).toEqual(['error']);
    expect(sev(check([plain], ['offscreen']))).toEqual(['error']);
  });
  it('offscreen: el objetivo cortado es error aunque el mundo esté acercado y asentado; solo mientras la cámara viaja hacia él (se mueve y no está asentada) queda info', () => {
    expect(sev(check([inWorld({ rect: cutRect, target: true }, 2, true)], ['offscreen']))).toEqual(['error']);
    expect(sev(check([inWorld({ rect: cutRect, target: true, motion: 40 }, 2, true)], ['offscreen']))).toEqual(['error']); // asentado: el movimiento no lo excusa
    expect(sev(check([inWorld({ rect: cutRect, target: true, motion: 40 }, 2, false)], ['offscreen']))).toEqual(['info']); // viajando
    expect(sev(check([inWorld({ rect: cutRect, target: true }, 2, false)], ['offscreen']))).toEqual(['error']); // quieto y sin asentar: error
  });
  it('un texto entero dentro del encuadre se sigue juzgando normal (overlap entre dos textos enteros es error)', () => {
    const a = inWorld({ rect: { x: 400, y: 400, w: 300, h: 40 } });
    const b = inWorld({ rect: { x: 420, y: 405, w: 300, h: 40 } });
    expect(sev(check([a, b], ['overlap']))).toEqual(['error']);
  });
  it('overlap: un par donde uno está cortado por el borde baja a info; si uno es el objetivo, no', () => {
    const a = inWorld({ rect: { x: 1700, y: 400, w: 400, h: 40 } });
    const b = inWorld({ rect: { x: 1720, y: 405, w: 300, h: 40 } });
    expect(sev(check([a, b], ['overlap']))).toEqual(['info']);
    const t = inWorld({ rect: { x: 1720, y: 405, w: 300, h: 40 }, target: true });
    expect(sev(check([a, t], ['overlap']))).toEqual(['error']);
  });
  it('covered: texto cortado y tapado baja a info; el entero sigue siendo error; el objetivo tapado es error aunque se mueva si está asentado', () => {
    const cover = { id: 99, key: 'c', tag: 'div', testid: 'card', text: '', rect: { x: 1750, y: 380, w: 300, h: 80 }, ignore: [] as string[] };
    const cut = inWorld({ rect: cutRect, cover });
    const whole = inWorld({ rect: { x: 400, y: 400, w: 300, h: 40 }, cover: { ...cover, rect: { x: 380, y: 380, w: 340, h: 80 } } });
    expect(sev(check([cut], ['covered']))).toEqual(['info']);
    expect(sev(check([whole], ['covered']))).toEqual(['error']);
    const tgt = inWorld({ rect: { x: 400, y: 400, w: 300, h: 40 }, target: true, motion: 30, cover: { ...cover, rect: { x: 380, y: 380, w: 340, h: 80 }, motion: 30 } }, 2, true);
    expect(sev(check([tgt], ['covered']))).toEqual(['error']);
    const traveling = inWorld({ rect: { x: 400, y: 400, w: 300, h: 40 }, target: true, motion: 30, cover: { ...cover, rect: { x: 380, y: 380, w: 340, h: 80 } } }, 2, false);
    expect(sev(check([traveling], ['covered']))).toEqual(['info']);
  });
  it('contrast: el texto cortado por el borde con el mundo acercado baja a info; el entero y el objetivo siguen juzgándose', () => {
    const low = { color: 'rgba(214,214,214,1)', bg: { r: 255, g: 255, b: 255, samples: 9 } };
    expect(sev(check([inWorld({ rect: cutRect, ...low })], ['contrast']))).toEqual(['info']);
    expect(sev(check([inWorld({ ...low })], ['contrast']))).toEqual(['error']);
    expect(sev(check([inWorld({ rect: cutRect, target: true, ...low }, 2, true)], ['contrast']))).toEqual(['error']);
  });
  it('edgeCut: solo texto del mundo acercado, que no es el objetivo, que el borde corta; entero o del todo afuera no cuenta', () => {
    expect(edgeCut(inWorld({ rect: cutRect }), W, H, 1)).toBe(true);
    expect(edgeCut(inWorld({ rect: cutRect }, 1), W, H, 1)).toBe(false);
    expect(edgeCut(inWorld({ rect: cutRect, target: true }), W, H, 1)).toBe(false);
    expect(edgeCut(run({ rect: cutRect }), W, H, 1)).toBe(false);
    expect(edgeCut(inWorld({ rect: { x: 400, y: 400, w: 300, h: 40 } }), W, H, 1)).toBe(false);
    expect(edgeCut(inWorld({ rect: { x: 2000, y: 400, w: 300, h: 40 } }), W, H, 1)).toBe(false);
  });
});

describe('data-qa-overlay: capa fija sobre el mundo', () => {
  const panel = (rect: Rect, opacity = 1): AnchorInfo => ({ key: 'o', tag: 'div', testid: 'etiqueta', text: '', rect, opacity, ignore: [], paint: [rect] });
  it('overlap: el texto de una capa que pisa texto del mundo no es defecto; el del objetivo, sí; entre textos de la propia capa, sí', () => {
    const rect = { x: 400, y: 400, w: 300, h: 40 };
    const world = inWorld({ rect }, 1);
    const label = run({ rect: { x: 420, y: 405, w: 300, h: 40 }, overlay: true });
    expect(check([world, label], ['overlap'])).toEqual([]);
    const target = inWorld({ rect, target: true }, 1, true);
    expect(sev(check([target, label], ['overlap']))).toEqual(['error']);
    const other = run({ rect: { x: 430, y: 410, w: 300, h: 40 }, overlay: true });
    expect(sev(check([label, other], ['overlap']))).toEqual(['error']);
  });
  it('contrast: el texto del mundo con una capa pintando encima baja a info; sin la marca (sin overlays), error; el texto de la capa se juzga', () => {
    const low = { color: 'rgba(214,214,214,1)', bg: { r: 255, g: 255, b: 255, samples: 9 } };
    const rect = { x: 400, y: 400, w: 300, h: 40 };
    const world = inWorld({ rect, ...low }, 1);
    expect(sev(check([world], ['contrast'], { overlays: [panel({ x: 380, y: 380, w: 400, h: 80 })] }))).toEqual(['info']);
    expect(sev(check([world], ['contrast']))).toEqual(['error']);
    expect(sev(check([world], ['contrast'], { overlays: [panel({ x: 1000, y: 380, w: 400, h: 80 })] }))).toEqual(['error']); // la capa no toca el texto
    const own = run({ rect, overlay: true, ...low });
    expect(sev(check([own], ['contrast'], { overlays: [panel({ x: 380, y: 380, w: 400, h: 80 })] }))).toEqual(['error']);
    const target = inWorld({ rect, target: true, ...low }, 1, true);
    expect(sev(check([target], ['contrast'], { overlays: [panel({ x: 380, y: 380, w: 400, h: 80 })] }))).toEqual(['error']);
  });
});

describe('texto-chico dentro de un mundo marcado', () => {
  const small = (p: Partial<TextRun> = {}) => run({ screenPx: 19, motion: 0, fade: 0, ...p });
  it('el resto del texto del mundo no genera aviso; el objetivo con la cámara asentada sí, con el tamaño efectivo; sin asentar, no', () => {
    expect(check([small({ world: { key: 'w', zoom: 1, settled: true } })], ['texto-chico'])).toEqual([]);
    const t = check([small({ world: { key: 'w', zoom: 1.5, settled: true }, target: true, fontPx: 12.7 })], ['texto-chico']);
    expect(t).toMatchObject([{ severity: 'warn', message: expect.stringContaining('falta zoom o una tarjeta de dato') }]);
    expect(check([small({ world: { key: 'w', zoom: 1.5, settled: false }, target: true })], ['texto-chico'])).toEqual([]);
  });
  it('fuera de un mundo marcado no cambia nada (el texto chico quieto avisa, también si hay objetivo sin mundo)', () => {
    expect(check([small()], ['texto-chico'])).toHaveLength(1);
    expect(check([small({ target: true })], ['texto-chico'])).toHaveLength(1);
  });
});

describe('foco-centro', () => {
  const target = (cx: number, cy = H / 2, p: Partial<AnchorInfo> = {}): AnchorInfo => ({ key: 't', tag: 'div', testid: 'objetivo', text: 'Importe', rect: { x: cx - 50, y: cy - 20, w: 100, h: 40 }, opacity: 1, ignore: [], ...p });
  const world = (settled: boolean): WorldInfo => ({ key: 'w', rect: { x: 0, y: 0, w: W, h: H }, zoom: 1, settled });
  const foco = (t: AnchorInfo[], settled = true) => check([], ['foco-centro'], { worlds: [world(settled)], targets: t });
  it('dentro del 60 % central no avisa; entre 60 y 85 % avisa; más allá es error; fuera del cuadro es error', () => {
    expect(foco([target(W / 2)])).toEqual([]);
    expect(foco([target(W / 2 + 0.6 * (W / 2))])).toEqual([]); // justo en el borde de la zona
    expect(sev(foco([target(W / 2 + 0.7 * (W / 2))]))).toEqual(['warn']);
    expect(sev(foco([target(W / 2 + 0.95 * (W / 2))]))).toEqual(['error']);
    expect(sev(foco([target(W / 2, H / 2 + 0.7 * (H / 2))]))).toEqual(['warn']); // también en vertical
    expect(sev(foco([target(W + 400)]))).toEqual(['error']);
  });
  it('sin cámara asentada, sin objetivo o con el objetivo tenue o marcado data-qa-ignore no juzga; con --set foco-centro.zone cambia la zona', () => {
    expect(foco([target(W - 60)], false)).toEqual([]);
    expect(foco([])).toEqual([]);
    expect(foco([target(W - 60, H / 2, { opacity: 0.1 })])).toEqual([]);
    expect(foco([target(W - 60, H / 2, { ignore: ['foco-centro'] })])).toEqual([]);
    const loose = { ...DEFAULT_THRESHOLDS, 'foco-centro': { ...DEFAULT_THRESHOLDS['foco-centro'], zone: 0.9 } };
    expect(check([], ['foco-centro'], { worlds: [world(true)], targets: [target(W / 2 + 0.7 * (W / 2))], thresholds: loose })).toEqual([]);
  });
});

describe('judgement: lo que baja a info por el borde se cuenta aparte', () => {
  it('cuenta el texto del mundo, el cortado y las capas que no tapan; sin marcas el resumen no tiene esas claves', () => {
    const ctx = { frame: 1, width: W, height: H, thresholds: DEFAULT_THRESHOLDS } as RuleContext;
    const plain = judgement({ ...ctx, runs: [run({})] });
    expect(plain.partial).toEqual({ decor: 0, veil: 0, ignoredSome: 0, gradientText: 0 });
    expect(plain.overlayCoverSkipped).toBeUndefined();
    const j = judgement({ ...ctx, runs: [inWorld({ rect: cutRect }), inWorld({}), inWorld({ target: true }), run({ overlay: true }), inWorld({ skippedOverlay: 1 })] });
    expect(j.judged).toBe(5);
    expect(j.partial).toMatchObject({ worldText: 3, worldCut: 1 });
    expect(j.overlayCoverSkipped).toBe(1);
    const total = emptyJudged();
    addJudged(total, j);
    addJudged(total, j);
    addJudged(total, plain);
    expect(total.partial).toMatchObject({ worldText: 6, worldCut: 2 });
    expect(total.overlayCoverSkipped).toBe(2);
  });
});
