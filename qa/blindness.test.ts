// @vitest-environment node
// La ceguera del control: una capa de cuadro completo marcada `data-qa-ignore="covered"` (viñeta, lavado, fondo del escenario) no puede hacer que el control
// deje de mirar el texto de abajo. Estas pruebas son sobre datos; el caso real (con Chromium) esta en `qa/e2e.test.ts` y en `examples/qa-defects` (cuadros 76-92).
import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from './thresholds';
import { inkFractions, type Raster } from './png';
import { addJudged, emptyJudged, judgement, runRules, visibleRuns } from './rules';
import { checkUnjudged } from './rules/unjudged';
import { buildMatrix, formatMatrix, parseThemes } from './themes';
import type { QaResult } from './run';
import type { Finding, Rect, RuleContext, TextRun } from './types';

const W = 1920, H = 1080;
let next = 0;
function run(p: Partial<TextRun> & { rect?: Rect } = {}): TextRun {
  const id = next++;
  const rect = p.rect ?? { x: 400, y: 400, w: 300, h: 40 };
  return {
    id, key: `k${id}`, elId: id + 1, chain: [id + 1], tag: 'div', testid: `t${id}`, text: 'Texto', rect, lines: [rect], opacity: 1, fontPx: 32, scale: 1,
    transformed: false, screenPx: 32, bold: false, color: 'rgba(20,20,20,1)', transparentFill: false, ignore: [], clips: [],
    own: { sw: 300, cw: 300, sh: 40, ch: 40, ox: 'visible', oy: 'visible', ellipsis: false }, cover: null, ...p,
  };
}
const ctxOf = (runs: TextRun[]): RuleContext => ({ frame: 3, width: W, height: H, runs, thresholds: DEFAULT_THRESHOLDS });
const fullCover = (extra: object = {}) => ({ tag: 'div', testid: 'capa', text: '', rect: { x: 0, y: 0, w: W, h: H }, ignore: [], id: 900, key: 'capa', frac: 1, opacity: 1, ...extra });

describe('visibleRuns: un texto se descarta solo si de verdad no se ve', () => {
  it('bajo una capa opaca de cuadro completo sin evidencia de pixeles: se descarta (como siempre)', () => {
    const t = run({ cover: fullCover() });
    expect(visibleRuns(ctxOf([t]))).toEqual([]);
  });
  it('con evidencia de que los pixeles NO cambian: se descarta; con evidencia de que SE VE: se juzga igual', () => {
    const hidden = run({ cover: fullCover(), ink: { frac: 0 } });
    const seen = run({ cover: fullCover(), ink: { frac: 0.2 } });
    expect(visibleRuns(ctxOf([hidden, seen])).map((r) => r.id)).toEqual([seen.id]);
  });
  it('una capa lisa cerrada y marcada (hiddenBy) tapa el texto solo si los pixeles lo confirman', () => {
    const closed = run({ hiddenBy: { key: 'w', testid: 'wash' }, ink: { frac: 0 } });
    const leaking = run({ hiddenBy: { key: 'w', testid: 'wash' }, ink: { frac: 0.3 } });
    expect(visibleRuns(ctxOf([closed, leaking])).map((r) => r.id)).toEqual([leaking.id]);
  });
  it('una tapa que no es de cuadro completo nunca descarta el texto', () => {
    const t = run({ cover: fullCover({ rect: { x: 0, y: 0, w: 200, h: 100 } }) });
    expect(visibleRuns(ctxOf([t]))).toHaveLength(1);
  });
  it('un texto visible bajo una capa que se creyo opaca igual recibe las reglas geometricas (el overlap se informa)', () => {
    const a = run({ cover: fullCover(), ink: { frac: 0.2 }, rect: { x: 400, y: 400, w: 300, h: 40 } });
    const b = run({ cover: fullCover(), ink: { frac: 0.2 }, rect: { x: 420, y: 410, w: 300, h: 40 } });
    expect(runRules(ctxOf([a, b]), ['overlap']).map((f) => f.rule)).toEqual(['overlap']);
  });
});

describe('regla unjudged: la red de seguridad', () => {
  it('con el control actual no hay texto visible sin juzgar', () => {
    const t = run({ cover: fullCover(), ink: { frac: 0.2 } });
    expect(runRules(ctxOf([t]), ['unjudged'])).toEqual([]);
  });
  it('si una version futura de visibleRuns vuelve a descartar texto que se ve, es un error', () => {
    const blind = () => [] as TextRun[]; // el defecto de antes: la viñeta hacia que todo quedara fuera
    const t = run({ cover: fullCover(), ink: { frac: 0.2 } });
    const f = checkUnjudged(ctxOf([t]), blind);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: 'unjudged', severity: 'error' });
    // lo que no se ve, lo que la escena excluye a proposito y lo casi transparente no cuentan
    expect(checkUnjudged(ctxOf([run({ ink: { frac: 0 } }), run({ ink: { frac: 0.5 }, ignore: ['all'] }), run({ ink: { frac: 0.5 }, opacity: 0.01 }), run()]), blind)).toEqual([]);
  });
});

describe('judgement: cuanto texto se juzgo y cuanto no, y por que', () => {
  it('cuenta tapados, fuera del cuadro, transparentes, excluidos por marca y los juzgados solo en parte', () => {
    const runs = [
      run({ cover: fullCover(), ink: { frac: 0 } }),
      run({ rect: { x: -500, y: 10, w: 100, h: 20 } }),
      run({ opacity: 0.01 }),
      run({ ignore: ['all'] }),
      run({ decor: true }),
      run({ ignore: ['contrast', 'covered'], skippedCovers: 1 }),
      run({ veil: { key: 'v', opacity: 0.5, testid: null } }),
      run({ transparentFill: true }),
      run(),
    ];
    const j = judgement(ctxOf(runs));
    expect(j.texts).toBe(9);
    expect(j.notJudged).toEqual({ total: 4, hidden: 1, ignoredAll: 1, outside: 1, invisible: 1 });
    expect(j.judged).toBe(5);
    expect(j.partial).toEqual({ decor: 1, veil: 1, ignoredSome: 1, gradientText: 1 });
    expect(j.ignoredByRule).toEqual({ contrast: 1, covered: 1 });
    expect(j.coverMarkerSkipped).toBe(1);
    const sum = emptyJudged();
    addJudged(sum, j); addJudged(sum, j);
    expect(sum.texts).toBe(18);
    expect(sum.ignoredByRule['contrast']).toBe(2);
  });
});

describe('inkFractions: evidencia de pixeles', () => {
  const img = (fill: number, box?: Rect, v = 0): Raster => {
    const data = new Uint8Array(100 * 50 * 4).fill(fill);
    if (box) for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) { const o = (y * 100 + x) * 4; data[o] = data[o + 1] = data[o + 2] = v; }
    return { width: 100, height: 50, data };
  };
  it('fraccion de pixeles que cambian al ocultar el texto; null fuera de la imagen', () => {
    const shown = img(255, { x: 10, y: 10, w: 10, h: 10 }, 20);
    const hidden = img(255);
    const [a, b, c] = inkFractions(shown, hidden, [[{ x: 10, y: 10, w: 10, h: 10 }], [{ x: 50, y: 10, w: 10, h: 10 }], [{ x: 500, y: 10, w: 10, h: 10 }]]);
    expect(a!.frac).toBe(1);
    expect(b!.frac).toBe(0);
    expect(c).toBeNull();
  });
  it('una capa casi opaca (diferencia chica) no cuenta como tinta', () => {
    const [a] = inkFractions(img(255, { x: 0, y: 0, w: 10, h: 10 }, 240), img(255), [[{ x: 0, y: 0, w: 10, h: 10 }]]);
    expect(a!.frac).toBe(0);
  });
});

describe('--themes: matriz y diferencias', () => {
  const fnd = (frame: number, rule: string, severity: string, testid: string): Finding => ({ rule: rule as never, severity: severity as never, frame, message: `${rule} ${testid}`, element: { tag: 'p', testid, text: testid, rect: { x: 0, y: 0, w: 1, h: 1 } } });
  const res = (findings: Finding[]): QaResult => ({ findings, summary: { videoId: 'v', frames: [0], total: findings.length, errors: 0, warnings: 0, infos: 0, byRule: {}, judged: emptyJudged(), seconds: 1 } });
  it('parseThemes: lista, all y errores', () => {
    expect(parseThemes('all')).toEqual(['neutral', 'dark', 'editorial', 'neon', 'papel']);
    expect(parseThemes('neon, dark,neon')).toEqual(['neon', 'dark']);
    expect(() => parseThemes('rosa')).toThrow(/desconocido/);
  });
  it('los hallazgos en todos los sistemas no son diferencia; los que faltan en alguno, si; info no cuenta', () => {
    const m = buildMatrix({
      neutral: res([fnd(1, 'contrast', 'error', 'a'), fnd(2, 'clip', 'error', 'b'), fnd(3, 'overlap', 'info', 'z')]),
      neon: res([fnd(1, 'contrast', 'error', 'a'), fnd(2, 'clip', 'warn' as never, 'b')]),
      papel: res([fnd(1, 'contrast', 'error', 'a'), fnd(4, 'min-size', 'error', 'c')]),
    });
    expect(m.cells['neutral']).toEqual({ errors: 2, warnings: 0, byRule: { contrast: { error: 1, warn: 0 }, clip: { error: 1, warn: 0 } } });
    expect(m.differences.map((d) => `${d.frame}:${d.rule}:${d.present.join('+')}`)).toEqual(['2:clip:neutral+neon', '4:min-size:papel']);
    expect(formatMatrix(m)).toMatch(/TOTAL\s+2\/0\s+1\/1\s+2\/0/);
  });
});
