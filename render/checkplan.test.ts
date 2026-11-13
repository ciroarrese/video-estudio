// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { planCheckFrames, sceneCheckFrames } from './plan';

describe('sceneCheckFrames', () => {
  it('toma varios cuadros cerca del inicio y el resto hasta el final', () => {
    const f = sceneCheckFrames(300, 120, 6);
    expect(f).toHaveLength(6);
    expect(f.slice(0, 3)).toEqual([302, 310, 324]);
    expect(f.at(-1)).toBe(300 + 119);
    expect(f).toEqual([...f].sort((a, b) => a - b));
  });
  it('una escena corta toma todos sus cuadros; una de 8 cuadros con n=6 no pasa del final', () => {
    expect(sceneCheckFrames(10, 4, 6)).toEqual([10, 11, 12, 13]);
    const f = sceneCheckFrames(0, 8, 6);
    expect(Math.max(...f)).toBeLessThanOrEqual(7);
    expect(new Set(f).size).toBe(f.length);
  });
});

describe('planCheckFrames', () => {
  const scenes = [
    { id: 'a', from: 0, durationInFrames: 100 },
    { id: 'b', from: 100, durationInFrames: 200 },
    { id: 'c', from: 300, durationInFrames: 100 },
  ];
  it('video con escenas: al menos 6 cuadros por escena y varios cerca de cada inicio', () => {
    const p = planCheckFrames({ first: 0, last: 399, scenes });
    for (const s of scenes) {
      const dentro = p.frames.filter((f) => f >= s.from && f < s.from + s.durationInFrames);
      expect(dentro.length, s.id).toBeGreaterThanOrEqual(6);
      expect(dentro.filter((f) => f - s.from <= 24).length, s.id).toBeGreaterThanOrEqual(3);
    }
    expect(p.summary).toMatch(/3 escenas/);
  });
  it('sin escenas: 12 repartidos; --check-count cambia la cantidad', () => {
    expect(planCheckFrames({ first: 0, last: 599 }).frames).toHaveLength(12);
    expect(planCheckFrames({ first: 0, last: 599, count: 30 }).frames).toHaveLength(30);
  });
  it('--frames a-b se queda dentro del rango y no agrega cuadros por escena', () => {
    const p = planCheckFrames({ first: 120, last: 260, explicitRange: true, scenes });
    expect(p.frames).toHaveLength(12);
    expect(Math.min(...p.frames)).toBe(120);
    expect(Math.max(...p.frames)).toBe(260);
    expect(p.summary).toMatch(/--frames/);
    expect(planCheckFrames({ first: 5, last: 8, explicitRange: true }).frames).toEqual([5, 6, 7, 8]);
  });
  it('--check-all devuelve todos los cuadros del rango', () => {
    expect(planCheckFrames({ first: 10, last: 14, all: true }).frames).toEqual([10, 11, 12, 13, 14]);
  });
  it('una escena recortada por el rango solo aporta los cuadros que caen adentro', () => {
    const p = planCheckFrames({ first: 100, last: 299, scenes });
    expect(p.frames.every((f) => f >= 100 && f <= 299)).toBe(true);
  });
});

import { cleanPageError } from './meta';
describe('cleanPageError', () => {
  it('quita el rastro de pila del navegador y deja el mensaje', () => {
    const m = 'page.evaluate: Error: No cargó una fuente\n  - "X" desde /x.otf: ...\n    at xe (http://127.0.0.1:39747/assets/index-a.js:3:678)\n    at async http://127.0.0.1:39747/assets/index-a.js:13:81';
    expect(cleanPageError(m)).toBe('No cargó una fuente\n  - "X" desde /x.otf: ...');
  });
});
