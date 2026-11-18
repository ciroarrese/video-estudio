// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { crearProgreso, estimarRestante, formatearDuracion } from './progreso';

describe('formatearDuracion', () => {
  it('segundos, minutos y horas', () => {
    expect(formatearDuracion(0)).toBe('0 s');
    expect(formatearDuracion(44.6)).toBe('45 s');
    expect(formatearDuracion(125)).toBe('2 min 05 s');
    expect(formatearDuracion(3725)).toBe('1 h 02 min');
  });
});

describe('estimarRestante', () => {
  it('usa la velocidad reciente, no el promedio desde el inicio', () => {
    // 100 cuadros en los primeros 100 s (1 por segundo), después 300 cuadros en 30 s (10 por segundo)
    const m = [{ t: 0, hechos: 0 }, { t: 100_000, hechos: 100 }, { t: 130_000, hechos: 400 }];
    // quedan 600: a 10 por segundo son 60 s (el promedio global, 3 por segundo, daría 200 s)
    expect(estimarRestante(m, 1000, 60_000)).toBeCloseTo(60, 0);
  });
  it('sin datos o sin avance, null', () => {
    expect(estimarRestante([], 10)).toBeNull();
    expect(estimarRestante([{ t: 0, hechos: 0 }], 10)).toBeNull();
    expect(estimarRestante([{ t: 0, hechos: 5 }, { t: 1000, hechos: 5 }], 10)).toBeNull();
  });
});

describe('crearProgreso', () => {
  it('una línea por cada 5 %, con el tiempo restante; sin ETA al terminar', () => {
    let t = 0;
    const lineas: string[] = [];
    const p = crearProgreso((m) => lineas.push(m), 'render', { ahora: () => t });
    for (let i = 1; i <= 200; i++) {
      t = i * 1000; // 1 cuadro por segundo
      p(i, 200);
    }
    expect(lineas).toHaveLength(20);
    expect(lineas[0]).toBe('render: 5% (10/200 cuadros, 1.0 fps, faltan ~3 min 10 s)');
    expect(lineas[9]).toContain('50% (100/200 cuadros');
    expect(lineas[9]).toContain('faltan ~1 min 40 s');
    expect(lineas[19]).toBe('render: 100% (200/200 cuadros, 1.0 fps)');
  });
  it('un tramo lento imprime al menos una línea por minuto, sin repetir el mismo porcentaje', () => {
    let t = 0;
    const lineas: string[] = [];
    const p = crearProgreso((m) => lineas.push(m), 'render', { ahora: () => t });
    p(1, 10000); // 0 %
    for (let i = 2; i <= 20; i++) {
      t = (i - 1) * 10_000; // un cuadro cada 10 s: 190 s en total, sin llegar al 5 % (500 cuadros)
      p(i, 10000);
    }
    expect(lineas.length).toBe(3); // a los 60, 120 y 180 s
    expect(lineas[0]).toMatch(/^render: 0% \(7\/10000 cuadros/); // a los 60 s van 7 cuadros
    expect(lineas.every((l) => /faltan ~/.test(l))).toBe(true);
  });
});
