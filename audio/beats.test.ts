// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { beatAt, beatPhase, framesPerBeat, nearestBeat, pulse } from './beats';

const beats = [10, 25, 40, 55]; // 15 cuadros por pulso

describe('beats', () => {
  it('beatAt es la posición continua en pulsos', () => {
    expect(beatAt(10, beats)).toBe(0);
    expect(beatAt(32.5, beats)).toBeCloseTo(1.5, 9);
    expect(beatAt(55, beats)).toBe(3);
    expect(beatAt(2.5, beats)).toBeCloseTo(-0.5, 9); // extrapola antes
    expect(beatAt(70, beats)).toBeCloseTo(4, 9); // y después
    expect(beatAt(5, [])).toBe(0);
  });

  it('nearestBeat devuelve índice, cuadro y distancia con signo', () => {
    expect(nearestBeat(27, beats)).toEqual({ index: 1, frame: 25, distance: -2 });
    expect(nearestBeat(34, beats)).toEqual({ index: 2, frame: 40, distance: 6 });
    expect(nearestBeat(0, [])).toBeNull();
  });

  it('pulse vale 1 en el pulso, decae y es 0 antes del primero', () => {
    expect(pulse(25, beats, 0.3)).toBeCloseTo(1, 9);
    expect(pulse(32.5, beats, 0.5)).toBeCloseTo(Math.exp(-1), 9);
    expect(pulse(24.99, beats, 0.3)).toBeLessThan(0.1);
    expect(pulse(3, beats)).toBe(0);
  });

  it('fase y cuadros por pulso', () => {
    expect(beatPhase(17.5, beats)).toBeCloseTo(0.5, 9);
    expect(framesPerBeat(30, beats)).toBe(15);
  });
});
