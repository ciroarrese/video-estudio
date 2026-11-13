// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { leerCortes, leerFase, leerFinal, leerInicio, leerNum, parsear } from './args';

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

  it('--inicio acepta seccion:<n> (desde 1) y rechaza lo mal formado', () => {
    expect(leerInicio(op('--inicio', 'seccion:3'))).toEqual({ seccion: 3 });
    expect(() => leerInicio(op('--inicio', 'seccion:0'))).toThrow(/entero desde 1/);
    expect(() => leerInicio(op('--inicio', 'seccion:'))).toThrow(/entero desde 1/);
    expect(() => leerInicio(op('--inicio', 'seccion:2.5'))).toThrow(/entero desde 1/);
  });

  it('--corte-en acepta segundos y cuadros con prefijo f', () => {
    expect(leerCortes(op('--corte-en', '12.5,f450, 30'), 30)).toEqual([12.5, 15, 30]);
    expect(leerCortes(op(), 30)).toBeUndefined();
    expect(() => leerCortes(op('--corte-en', 'abc'), 30)).toThrow(/--corte-en/);
    expect(() => leerCortes(op('--corte-en', 'f'), 30)).toThrow(/--corte-en/);
    expect(() => leerCortes(op('--corte-en'), 30)).toThrow(/necesita un valor/);
  });

  it('--fase y --final solo aceptan sus valores', () => {
    expect(leerFase(op('--fase', 'medio'))).toBe('medio');
    expect(leerFase(op())).toBeUndefined();
    expect(() => leerFase(op('--fase', 'doble'))).toThrow(/medio/);
    expect(leerFinal(op('--final', 'real'))).toBe('real');
    expect(leerFinal(op('--final', 'fade'))).toBe('fade');
    expect(() => leerFinal(op('--final', 'corte'))).toThrow(/fade/);
  });
});
