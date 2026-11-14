import { describe, expect, it } from 'vitest';
import { applyMotion, coverKeys } from './motion';
import { rectShift } from './geometry';
import type { PageData, TextRun } from './types';

const run = (key: string, x: number, cover: TextRun['cover'] = null, opacity = 1) =>
  ({ key, rect: { x, y: 0, w: 100, h: 20 }, opacity, cover, motion: undefined }) as unknown as TextRun;
const page = (runs: TextRun[], elems: PageData['elems'] = {}): PageData => ({ frame: 0, width: 1, height: 1, runs, elems });

describe('motion', () => {
  it('rectShift is the largest edge displacement', () => {
    expect(rectShift({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 })).toBe(5);
    expect(rectShift({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 30, h: 10 })).toBe(20);
  });
  it('measures the largest shift over the neighbours; unmatched elements stay at 0', () => {
    const cover = { id: 1, key: 'c', tag: 'div', testid: null, text: '', rect: { x: 0, y: 0, w: 50, h: 50 }, ignore: [] };
    const cur = page([run('a', 100, cover), run('b', 0)]);
    expect(coverKeys(cur)).toEqual(['c']);
    applyMotion(cur, [
      page([run('a', 130)], { c: { x: 40, y: 0, w: 50, h: 50 } }),
      page([run('a', 105)]),
    ]);
    expect(cur.runs[0]!.motion).toBe(30);
    expect(cur.runs[0]!.cover!.motion).toBe(40);
    expect(cur.runs[1]!.motion).toBe(0);
  });
  it('measures the opacity change (fade) against the neighbours', () => {
    const cur = page([run('a', 0, null, 0.5), run('b', 0, null, 1)]);
    applyMotion(cur, [page([run('a', 0, null, 0.7), run('b', 0)]), page([run('a', 0, null, 0.3)])]);
    expect(cur.runs[0]!.fade).toBeCloseTo(0.2);
    expect(cur.runs[1]!.fade).toBe(0);
  });
  it('mide el cambio de opacidad del velo; un velo ausente en el vecino cuenta como 0', () => {
    const veil = { key: 'v', opacity: 0.5, testid: null };
    const cur = page([{ ...run('a', 0), veil } as TextRun, { ...run('b', 0), veil: { ...veil } } as TextRun, run('c', 0)]);
    expect(coverKeys(cur)).toEqual(['v']);
    const n = (o: number) => ({ ...page([run('a', 0)]), opac: { v: o } });
    applyMotion(cur, [n(0.44), n(0.56)]);
    expect(cur.runs[0]!.veil!.fade).toBeCloseTo(0.06);
    expect(cur.runs[2]!.veil).toBeUndefined();
    const solo = page([{ ...run('a', 0), veil: { ...veil } } as TextRun]);
    applyMotion(solo, [page([run('a', 0)])]); // el velo no existe en el cuadro vecino
    expect(solo.runs[0]!.veil!.fade).toBeCloseTo(0.5);
    const quieto = page([{ ...run('a', 0), veil: { ...veil } } as TextRun]);
    applyMotion(quieto, [n(0.5), n(0.5)]);
    expect(quieto.runs[0]!.veil!.fade).toBe(0);
  });
  it('un contador (el texto cambia en cada cuadro) se empareja con sus vecinos por la ruta, y mide el fundido', () => {
    const num = (n: string, o: number) => ({ ...run(`0.1|span||${n}#0`, 0, null, o), text: n }) as TextRun;
    const cur = page([num('194', 0.5)]);
    applyMotion(cur, [page([num('190', 0.45)]), page([num('197', 0.55)])]);
    expect(cur.runs[0]!.fade).toBeCloseTo(0.05);
    // texto que no es numerico no se empareja si cambia
    const w = (t: string, o: number) => ({ ...run(`0.1|span||${t}#0`, 0, null, o), text: t }) as TextRun;
    const c2 = page([w('Hola', 0.5)]);
    applyMotion(c2, [page([w('Chau', 0.9)])]);
    expect(c2.runs[0]!.fade).toBe(0);
  });
  it('empareja por etiqueta + testid + texto cuando cambia la ruta del DOM (un hermano que se monta corre los índices)', () => {
    const t = (path: string, x: number, o: number, text = 'Cena en la plaza') => ({ ...run(`${path}|span||#0`, x, null, o), tag: 'span', testid: null, text }) as TextRun;
    const cur = page([t('0.1.2', 100, 0.5)]);
    applyMotion(cur, [page([t('0.1.1', 130, 0.4)]), page([t('0.1.2', 100, 0.52)])]);
    expect(cur.runs[0]!.motion).toBe(30);
    expect(cur.runs[0]!.fade).toBeCloseTo(0.1);
    // texto repetido en el cuadro vecino: ambiguo, no se empareja
    const dup = page([t('0.1.2', 100, 0.5)]);
    applyMotion(dup, [page([t('0.1.1', 130, 0.4), t('0.1.3', 300, 0.9)])]);
    expect(dup.runs[0]!.motion).toBe(0);
  });
});
