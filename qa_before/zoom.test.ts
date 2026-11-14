// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mergeThresholds } from './thresholds';
import { reclassifyDetail, scopeOf, type Readable } from './zoom';
import type { Finding } from './types';

const dims = { width: 1920, height: 1080, duration: 600 };
const th = mergeThresholds();
const small = (frame: number, key: string, px = 9): Finding => ({
  rule: 'min-size', severity: 'error', frame, message: 'texto chico',
  element: { tag: 'div', testid: null, text: key, rect: { x: 0, y: 0, w: 10, h: 10 } }, data: { screenPx: px, min: 18, key },
});
const scenes = [{ id: 'panel', from: 0, durationInFrames: 300 }, { id: 'cierre', from: 300, durationInFrames: 300 }];
const readable = (m: Record<string, Record<string, Readable>>) => new Map(Object.entries(m).map(([sc, keys]) => [sc, new Map(Object.entries(keys))]));

describe('scopeOf', () => {
  it('elige la escena más chica que contiene el cuadro; sin escenas, todo el video', () => {
    const nested = [...scenes, { id: 'detalle', from: 100, durationInFrames: 50 }];
    expect(scopeOf(120, nested, 600).id).toBe('detalle');
    expect(scopeOf(10, nested, 600).id).toBe('panel');
    expect(scopeOf(10, [], 600)).toEqual({ id: '', from: 0, to: 599 });
  });
});

describe('reclassifyDetail', () => {
  it('un texto chico que se lee (>= 18 px) en otro cuadro de su escena pasa a info con una línea resumen por cuadro', () => {
    const fs = [small(10, 'a'), small(10, 'b', 6), small(20, 'a')];
    const r = reclassifyDetail(fs, readable({ 'panel|0|299': { a: { px: 30, frame: 200 }, b: { px: 22, frame: 210 } } }), scenes, th, dims);
    expect(r.findings.filter((f) => f.severity === 'error')).toEqual([]);
    const info = r.findings.filter((f) => f.severity === 'info');
    expect(info.map((f) => [f.frame, f.data?.count, f.data?.detail])).toEqual([[10, 2, true], [20, 1, true]]);
    expect(info[0]!.message).toMatch(/se leen al acercar/);
    expect(info[0]!.data?.smallestPx).toBe(6);
    expect(r.detail).toEqual({ texts: 2, frames: 2 });
  });

  it('contraparte estricta: un texto que nunca llega al mínimo, o que solo se lee en OTRA escena, sigue siendo error', () => {
    const fs = [small(10, 'nunca'), small(10, 'otra-escena')];
    const r = reclassifyDetail(fs, readable({ 'panel|0|299': { nunca: { px: 12, frame: 100 } }, 'cierre|300|599': { 'otra-escena': { px: 40, frame: 400 } } }), scenes, th, dims);
    expect(r.findings.map((f) => f.severity)).toEqual(['error', 'error']);
    expect(r.detail).toBeNull();
  });

  it('un texto sin ninguna lectura visible (clave ausente) queda como error', () => {
    const r = reclassifyDetail([small(10, 'a')], readable({ 'panel|0|299': {} }), scenes, th, dims);
    expect(r.findings[0]!.severity).toBe('error');
  });
});
