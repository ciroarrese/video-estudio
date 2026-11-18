// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { curvaDeHuecos } from './huecos';
import { silenciosDe, silenciosInternos } from './silencios';

const sr = 1000;

describe('curvaDeHuecos', () => {
  it('la bajada termina justo en desdeSec, se sostiene y vuelve al terminar', () => {
    const c = curvaDeHuecos([{ desdeSec: 4, hastaSec: 6, fadeSec: 1 }], 10 * sr, sr);
    expect(c[2500]).toBe(1); // antes de la rampa
    expect(c[3500]!).toBeGreaterThan(0.3);
    expect(c[3500]!).toBeLessThan(0.7); // a mitad de la rampa
    expect(c[4000]).toBeCloseTo(0, 2); // donde empieza el hueco ya está callada
    expect(c[5000]).toBe(0);
    expect(c[6500]!).toBeGreaterThan(0.3);
    expect(c[7500]).toBe(1);
  });
  it('sin hastaSec la música no vuelve; con bajaDb baja esa cantidad', () => {
    const c = curvaDeHuecos([{ desdeSec: 3, fadeSec: 0.5 }], 10 * sr, sr);
    expect(c[9999]).toBe(0);
    const d = curvaDeHuecos([{ desdeSec: 3, hastaSec: 5, fadeSec: 0.5, bajaDb: 12 }], 10 * sr, sr);
    expect(20 * Math.log10(d[4000]!)).toBeCloseTo(-12, 1);
  });
  it('valida', () => {
    expect(() => curvaDeHuecos([{ desdeSec: 5, hastaSec: 4 }], 100, sr)).toThrow(/hastaSec/);
    expect(() => curvaDeHuecos([{ desdeSec: 1, bajaDb: 0 }], 100, sr)).toThrow(/bajaDb/);
  });
});

describe('silenciosDe / silenciosInternos', () => {
  it('encuentra el del comienzo, uno interno y la cola; los internos no incluyen los bordes', () => {
    const x = new Float32Array(10 * sr);
    for (let i = 1 * sr; i < 4 * sr; i++) x[i] = 0.3 * Math.sin(i * 0.5);
    for (let i = 5 * sr; i < 8 * sr; i++) x[i] = 0.3 * Math.sin(i * 0.5);
    const todos = silenciosDe(x, sr, { minSec: 0.5 });
    expect(todos.map((t) => [Math.round(t.desde), Math.round(t.hasta)])).toEqual([[0, 1], [4, 5], [8, 10]]);
    expect(silenciosInternos(x, sr, { minSec: 0.5 }).map((t) => [Math.round(t.desde), Math.round(t.hasta)])).toEqual([[4, 5]]);
    expect(silenciosInternos(x, sr, { minSec: 2 })).toEqual([]);
  });
});
