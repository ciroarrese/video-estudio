// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { detectarCuerpo } from './cuerpo';
import { conCaidaEnDb, pistaDeClics } from './pistas-de-prueba';

const sr = 8000;

describe('detectarCuerpo', () => {
  it('una pista pareja es todo cuerpo', () => {
    const x = pistaDeClics({ bpm: 120, seconds: 30, sr, padSec: 1 });
    const c = detectarCuerpo(x, sr);
    expect(c.inicioSec).toBe(0);
    expect(c.finSec).toBeCloseTo(30, 0);
    expect(c.introBaja).toBe(false);
    expect(c.colaSec).toBeLessThan(1);
  });

  it('detecta la caída final de 6 s', () => {
    const x = conCaidaEnDb(pistaDeClics({ bpm: 120, seconds: 44, sr, padSec: 2 }), sr, 36, 6, -60);
    const c = detectarCuerpo(x, sr);
    // El nivel baja 6 dB a los 0,6 s de empezar la caída (10 dB por segundo).
    expect(c.finSec).toBeGreaterThan(35.5);
    expect(c.finSec).toBeLessThan(37.5);
    expect(c.colaSec).toBeGreaterThan(6);
  });

  it('detecta una intro baja (más de 12 dB por debajo del cuerpo)', () => {
    const cuerpo = pistaDeClics({ bpm: 120, seconds: 40, sr, padSec: 2 });
    for (let i = 0; i < 6 * sr; i++) cuerpo[i] *= 0.01;
    const c = detectarCuerpo(cuerpo, sr);
    expect(c.introBaja).toBe(true);
    expect(c.inicioSec).toBeGreaterThan(5.5);
    expect(c.inicioSec).toBeLessThan(6.6);
  });

  it('una pista demasiado corta devuelve la pista entera', () => {
    const c = detectarCuerpo(new Float32Array(sr), sr);
    expect(c.inicioSec).toBe(0);
    expect(c.finSec).toBeCloseTo(1, 3);
  });
});
