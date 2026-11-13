// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { leerInicio, leerNum, parsear } from './args';

const op = (...a: string[]) => parsear(a).op;

describe('args', () => {
  it('--inicio inválido o sin valor falla con un mensaje claro', () => {
    expect(() => leerInicio(op('--inicio', 'foo'))).toThrow(/--inicio tiene que ser un número/);
    expect(() => leerInicio(op('--inicio'))).toThrow(/--inicio necesita un valor/);
    expect(() => leerInicio(op('--inicio', '--out', 'x.wav'))).toThrow(/necesita un valor/);
    expect(() => leerInicio(op('--inicio', '-3'))).toThrow(/al menos 0/);
    expect(leerInicio(op('--inicio', '4.5'))).toBe(4.5);
    expect(leerInicio(op('--inicio', 'percusion'))).toBe('percusion');
    expect(leerInicio(op())).toBeUndefined();
  });

  it('las opciones numéricas validan tipo, rango y enteros', () => {
    expect(() => leerNum(op('--fps'), 'fps')).toThrow(/necesita un valor/);
    expect(() => leerNum(op('--fps', 'abc'), 'fps')).toThrow(/número/);
    expect(() => leerNum(op('--fps', '0'), 'fps', 30, { min: 0, excluyeMin: true })).toThrow(/mayor que 0/);
    expect(() => leerNum(op('--compas', '2.5'), 'compas', undefined, { entero: true })).toThrow(/entero/);
    expect(() => leerNum(op('--bpm', 'Infinity'), 'bpm')).toThrow(/número/);
    expect(leerNum(op('--offset', '-0.5'), 'offset')).toBe(-0.5);
    expect(leerNum(op(), 'fps', 30)).toBe(30);
  });
});
