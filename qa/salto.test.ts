import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, mergeThresholds, parseOverrides } from './thresholds';
import { analyzeJumps, sideOf } from './salto';
import { runRules } from './rules';
import { findTransitions, MAX_GRID } from './pares';
import { groupFindings, whereOf } from './informe';
import type { AnchorInfo, Around, Finding, Geom, Rect, RuleContext, TextRun, WorldInfo } from './types';

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
const world = (x = 0, y = 0, w = W, h = H): WorldInfo => ({ key: 'w', rect: { x, y, w, h }, zoom: 1, settled: false });
/** Un texto del mundo con clave fija entre cuadros (como `keyOf`: ruta + etiqueta + testid + texto). */
const label = (name: string, x: number, p: Partial<TextRun> = {}): TextRun => run({ key: `0|p|${name}|T`, testid: name, text: `T${name}`, world: { key: 'w', zoom: 1, settled: false }, rect: { x, y: 400, w: 300, h: 40 }, ...p });
const geom = (runs: TextRun[], w: WorldInfo = world(), extra: Partial<Geom> = {}): Geom => ({ runs, worlds: [w], ...extra });
const over = (left: number, top = 300, p: Partial<AnchorInfo> = {}): AnchorInfo => ({ key: 'etq', tag: 'div', testid: 'etiqueta', text: 'Etiqueta', rect: { x: left, y: top, w: 220, h: 56 }, opacity: 1, ignore: [], ...p });
const tgt = (x: number, y = 300): AnchorInfo => ({ key: 'obj', tag: 'div', testid: 'objetivo', text: 'Importe', rect: { x, y, w: 200, h: 40 }, opacity: 1, ignore: [] });

/** Analiza el cuadro del medio de una terna (a, b, c). */
function mid(a: Geom, b: Geom, c: Geom, around: Partial<Around> = {}, thresholds = DEFAULT_THRESHOLDS) {
  return analyzeJumps({ frame: 10, width: W, height: H, runs: b.runs, worlds: b.worlds, overlays: b.overlays, targets: b.targets, thresholds, around: { prev: a, next: c, ...around } });
}
const msgs = (fs: Finding[]) => fs.map((f) => `${f.frame}:${f.severity}:${f.element.testid ?? f.element.text}`);

describe('salto: elementos del mundo', () => {
  it('avisa del texto que se corre de golpe en un cuadro y se queda quieto en el otro (en el cuadro del segundo paso)', () => {
    const r = mid(geom([label('a', 100)]), geom([label('a', 400)]), geom([label('a', 400)]));
    expect(msgs(r.findings)).toEqual(['10:warn:a']);
    expect(r.prev).toBe('juzgado');
    const r2 = mid(geom([label('a', 100)]), geom([label('a', 100)]), geom([label('a', 400)]));
    expect(msgs(r2.findings)).toEqual(['11:warn:a']); // el salto es del paso (10, 11)
  });
  it('no es un salto: movimiento continuo en varios cuadros (un vuelo o un easing), por debajo del umbral', () => {
    expect(mid(geom([label('a', 100)]), geom([label('a', 160)]), geom([label('a', 220)])).findings).toEqual([]);
    expect(mid(geom([label('a', 100)]), geom([label('a', 108)]), geom([label('a', 108)])).findings).toEqual([]); // 8 px < 16 px (24 a 1080)
  });
  it('no es un salto lo que explica la cámara: el mundo se mueve o se acerca y el texto va con él', () => {
    const pan = mid(geom([label('a', 100)], world(0)), geom([label('a', 40)], world(-60)), geom([label('a', -20)], world(-120)));
    expect(pan.findings).toEqual([]);
    // zoom x1.5 de golpe en el mundo (la cámara salta, el texto la sigue): el residuo del texto es 0
    const zoom = mid(geom([label('a', 400, { rect: { x: 400, y: 400, w: 300, h: 40 } })], world(0, 0, 1000, 800)), geom([label('a', 400, { rect: { x: 600, y: 600, w: 450, h: 60 } })], world(0, 0, 1500, 1200)), geom([label('a', 400, { rect: { x: 600, y: 600, w: 450, h: 60 } })], world(0, 0, 1500, 1200)));
    expect(zoom.findings).toEqual([]);
  });
  it('no es un salto lo que aparece o desaparece, entra con un fundido, es muy tenue o cambia de texto', () => {
    expect(mid(geom([]), geom([label('a', 400)]), geom([label('a', 400)])).findings).toEqual([]); // aparece
    expect(mid(geom([label('a', 100)]), geom([label('a', 400)]), geom([])).findings).toEqual([]); // desaparece
    expect(mid(geom([label('a', 100, { opacity: 0.2 })]), geom([label('a', 400, { opacity: 0.6 })]), geom([label('a', 400, { opacity: 1 })])).findings).toEqual([]); // entra con fundido
    expect(mid(geom([label('a', 100, { opacity: 0.2 })]), geom([label('a', 400, { opacity: 0.2 })]), geom([label('a', 400, { opacity: 0.2 })])).findings).toEqual([]); // tenue
    const b = label('a', 400);
    expect(mid(geom([label('a', 100)]), geom([{ ...b, key: '0|p|a|OTRO', text: 'otro' }]), geom([{ ...b, key: '0|p|a|OTRO', text: 'otro' }])).findings).toEqual([]);
  });
  it('un corte de escena no es un salto: el paso que cruza el inicio de una escena, o donde casi nada tiene pareja, no se juzga y se cuenta como corte', () => {
    const a = geom([label('a', 100)]), b = geom([label('a', 400)]), c = geom([label('a', 400)]);
    const cut = mid(a, b, c, { cutPrev: true });
    expect(cut.findings).toEqual([]);
    expect(cut.prev).toBe('corte');
    // nuevo contenido en el cuadro siguiente: de 5 textos solo 1 tiene pareja
    const five = (x: number) => ['a', 'b', 'c', 'd', 'e'].map((n) => label(n, x));
    const other = geom([label('a', 400), ...['x', 'y', 'z', 'w'].map((n) => label(n, 100))]);
    const r = mid(geom(five(100)), geom(five(400)), other);
    expect(r.next).toBe('corte');
    expect(r.prev).toBe('juzgado'); // el otro paso se sigue juzgando por su cuenta
  });
  it('sin marcas (ni mundo, ni capa, ni objetivo) o sin cuadros vecinos no juzga nada; data-qa-ignore="salto" y --set salto.px lo ajustan', () => {
    const plain = (x: number) => ({ runs: [run({ key: 'k', rect: { x, y: 400, w: 300, h: 40 } })] });
    expect(mid(plain(100), plain(400), plain(400)).findings).toEqual([]);
    expect(analyzeJumps({ frame: 3, width: W, height: H, runs: [label('a', 400)], worlds: [world()], thresholds: DEFAULT_THRESHOLDS }).findings).toEqual([]);
    const a = geom([label('a', 100)]), c = geom([label('a', 400)]);
    expect(mid(a, geom([label('a', 400, { ignore: ['salto'] })]), c).findings).toEqual([]);
    const lax = mergeThresholds(parseOverrides(['salto.px=400']));
    expect(mid(a, geom([label('a', 400)]), c, {}, lax).findings).toEqual([]);
    const tight = mergeThresholds(parseOverrides(['salto.px=4']));
    expect(mid(geom([label('a', 100)]), geom([label('a', 108)]), geom([label('a', 108)]), {}, tight).findings).toHaveLength(1);
  });
  it('el umbral sigue al lado corto del cuadro (24 px a 1080, 16 px a 720)', () => {
    const at = (w: number, h: number) => analyzeJumps({ frame: 10, width: w, height: h, runs: [label('a', 120)], worlds: [world(0, 0, w, h)], thresholds: DEFAULT_THRESHOLDS, around: { prev: geom([label('a', 100)], world(0, 0, w, h)), next: geom([label('a', 120)], world(0, 0, w, h)) } }).findings.length;
    expect(at(1920, 1080)).toBe(0); // 20 px < 24
    expect(at(1280, 720)).toBe(1); // 20 px >= 16
  });
});

describe('salto: capas fijas', () => {
  const G = (o: AnchorInfo, t: AnchorInfo[] = [tgt(500)], runs: TextRun[] = []): Geom => ({ runs, worlds: [world()], overlays: [o], targets: t });
  it('avisa del cambio de lado respecto del objetivo y del salto de la capa respecto del objetivo', () => {
    const flip = mid(G(over(730)), G(over(240)), G(over(240)));
    expect(msgs(flip.findings)).toEqual(['10:warn:etiqueta', '10:warn:etiqueta']); // el salto y el cambio de lado
    expect(flip.findings.some((f) => f.message.includes('cambia de lado') && f.message.includes('derecha') && f.message.includes('izquierda'))).toBe(true);
    const jump = mid(G(over(730)), G(over(790)), G(over(790)));
    expect(jump.findings).toHaveLength(1);
    expect(jump.findings[0]!.message).toContain('respecto del objetivo');
    expect(jump.findings[0]!.other?.testid).toBe('objetivo');
  });
  it('no es un salto: la capa pegada al objetivo mientras la cámara viaja, o un movimiento continuo', () => {
    const glued = mid(G(over(730), [tgt(500)]), G(over(690), [tgt(460)]), G(over(650), [tgt(420)]));
    expect(glued.findings).toEqual([]);
    expect(mid(G(over(730)), G(over(760)), G(over(790))).findings).toEqual([]);
  });
  it('no cuenta lo que entra (fundido), cambia de objetivo o no tiene pareja; sin objetivo mide lo que la capa se mueve de más que el mundo', () => {
    expect(mid(G(over(730, 300, { opacity: 0.1 })), G(over(240, 300, { opacity: 0.6 })), G(over(240))).findings).toEqual([]);
    expect(mid(G(over(730)), G(over(240)), G(over(240)), {}).findings).not.toEqual([]);
    const otro = (x: number): AnchorInfo => ({ ...tgt(x), key: 'otro' });
    expect(mid(G(over(730), [tgt(500)]), G(over(240), [otro(500)]), G(over(240), [otro(500)])).findings).toEqual([]);
    const sin = (left: number, wx: number): Geom => ({ runs: [], worlds: [world(wx)], overlays: [over(left)] });
    expect(mid(sin(100, 0), sin(400, 0), sin(400, 0)).findings).toHaveLength(1);
    expect(mid(sin(100, 0), sin(400, 300), sin(700, 600)).findings).toEqual([]); // la cámara lo explica
  });
  it('la barra de progreso (data-qa-overlay="progreso") no se juzga: fija en pantalla mientras el objetivo viaja', () => {
    const bar = (left: number): AnchorInfo => ({ ...over(left), key: 'barra', kind: 'progreso' });
    expect(mid(G(bar(100), [tgt(500)]), G(bar(100), [tgt(400)]), G(bar(100), [tgt(900)])).findings).toEqual([]);
    expect(mid(G(bar(100)), G(bar(700)), G(bar(700))).findings).toEqual([]);
  });
  it('sideOf: dominancia clara o nada (encima o en diagonal no cuenta)', () => {
    const a = { x: 500, y: 300, w: 200, h: 40 };
    expect(sideOf({ x: 730, y: 292, w: 220, h: 56 }, a)).toBe('derecha');
    expect(sideOf({ x: 240, y: 292, w: 220, h: 56 }, a)).toBe('izquierda');
    expect(sideOf({ x: 520, y: 380, w: 220, h: 56 }, a)).toBe('abajo');
    expect(sideOf({ x: 520, y: 200, w: 220, h: 56 }, a)).toBe('arriba');
    expect(sideOf({ x: 510, y: 305, w: 180, h: 30 }, a)).toBeNull();
  });
});

describe('salto como regla', () => {
  it('corre dentro de runRules con el contexto completo y se puede elegir o saltear como cualquier regla', () => {
    const ctx = { frame: 10, width: W, height: H, runs: [label('a', 400)], worlds: [world()], thresholds: DEFAULT_THRESHOLDS, around: { prev: geom([label('a', 100)]), next: geom([label('a', 400)]) } } as RuleContext;
    expect(runRules(ctx, ['salto']).map((f) => f.rule)).toEqual(['salto']);
    expect(runRules(ctx, ['clip'])).toEqual([]);
  });
});

describe('pares: cambios de data-qa-settled / data-qa-target', () => {
  it('encuentra el primer cuadro con la firma nueva (bisección) con pocas sondas, y respeta el máximo de cuadros extra', async () => {
    const sig = async (f: number) => (f >= 1234 ? 'B' : f >= 700 ? 'A' : '');
    const r = await findTransitions(sig, 0, 4819, 40);
    expect(r.frames).toEqual([700, 1234]);
    expect(r.probes).toBeLessThan(MAX_GRID + 2 * 12);
    const many = await findTransitions(async (f) => String(Math.floor(f / 50)), 0, 4819, 5);
    expect(many.found).toBeGreaterThan(5);
    expect(many.frames).toHaveLength(5);
    expect((await findTransitions(sig, 0, 4819, 0)).frames).toEqual([]);
    expect((await findTransitions(async () => 'x', 0, 4819, 40)).frames).toEqual([]);
  });
});

describe('informe: texto-chico agrupado por elemento', () => {
  const f = (frame: number, text: string): Finding => ({ rule: 'texto-chico', severity: 'warn', frame, message: 'm', element: { tag: 'span', testid: null, text, rect: { x: 0, y: 0, w: 1, h: 1 } } });
  it('una línea por elemento con la cuenta de cuadros; con un solo cuadro, su número; el resto de las reglas conserva los rangos', () => {
    const groups = groupFindings([f(10, 'Saldo'), f(20, 'Saldo'), f(30, 'Saldo'), f(10, 'Total')]);
    expect(groups).toHaveLength(2);
    const sampled = [10, 15, 20, 25, 30];
    expect(whereOf('texto-chico', groups[0]!.frames, sampled)).toBe('3 cuadros (10–30)');
    expect(whereOf('texto-chico', groups[1]!.frames, sampled)).toBe('10');
    expect(whereOf('clip', groups[0]!.frames, sampled)).toBe('10, 20, 30');
    expect(whereOf('clip', [10, 20], [10, 20])).toBe('10–20');
  });
});
