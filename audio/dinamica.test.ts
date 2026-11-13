// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { analizarEfecto, aplicarCurva, curvaDeDucking, limitar } from './dinamica';
import { picoVerdaderoDb } from './medidas';
import { sonoridadIntegrada, filtrosK } from './sonoridad';

const sr = 48000;
const aDb = (g: number) => 20 * Math.log10(g);

describe('curvaDeDucking', () => {
  it('baja exactamente la profundidad pedida dentro de la ventana, con ataque antes y release después', () => {
    const c = curvaDeDucking([{ iniSample: 10000, finSample: 30000, profundidadDb: 5 }], 60000, sr, 10, 250);
    expect(aDb(c[20000])).toBeCloseTo(-5, 3);
    expect(aDb(c[10000])).toBeCloseTo(-5, 1); // el ataque termina justo al empezar el efecto
    expect(aDb(c[9000])).toBeGreaterThan(-5); // todavía bajando
    expect(aDb(c[10000 - 481])).toBeCloseTo(0, 2); // 10 ms antes: sin bajar
    expect(aDb(c[5000])).toBe(0);
    // A los 250 ms de terminar el efecto, ya recuperó todo.
    expect(aDb(c[30000 + 12000 + 1])).toBeGreaterThan(-0.01);
    // A los 125 ms va por la mitad (perfil de coseno).
    expect(aDb(c[30000 + 6000])).toBeCloseTo(-2.5, 1);
  });

  it('con ventanas solapadas manda la más profunda, sin sumarlas', () => {
    const c = curvaDeDucking([{ iniSample: 1000, finSample: 20000, profundidadDb: 5 }, { iniSample: 5000, finSample: 9000, profundidadDb: 8 }], 40000, sr);
    expect(aDb(c[7000])).toBeCloseTo(-8, 2);
    expect(aDb(c[15000])).toBeCloseTo(-5, 2);
  });

  it('aplicarCurva multiplica todos los canales', () => {
    const x = Float32Array.from([1, 1, 1, 1]);
    aplicarCurva(x, Float32Array.from([0.5, 0.25]), 2);
    expect(Array.from(x)).toEqual([0.5, 0.5, 0.25, 0.25]);
  });
});

describe('analizarEfecto', () => {
  it('mide cuánto suena sobre el umbral (con su ganancia) y dónde está el pico', () => {
    const x = new Float32Array(sr);
    for (let i = 0; i < 0.3 * sr; i++) x[i] = 0.5 * Math.exp(-i / sr / 0.05) * Math.sin((2 * Math.PI * 1000 * i) / sr);
    const a = analizarEfecto(x, sr, 1, 0.02);
    // 0,5 * exp(-t/0,05) = 0,02 en t = 0,16 s.
    expect(a.activoSamples / sr).toBeGreaterThan(0.15);
    expect(a.activoSamples / sr).toBeLessThan(0.18);
    expect(a.picoSamples / sr).toBeLessThan(0.02);
    expect(analizarEfecto(x, sr, 0.2, 0.02).activoSamples).toBeLessThan(a.activoSamples);
  });
});

describe('limitar', () => {
  it('lleva el pico verdadero a -1 dBTP o menos aunque las crestas entre muestras pasen de las muestras', () => {
    for (const gain of [1, 2, 5, 20]) {
      const f = 11025 / 2 + 70;
      const x = new Float32Array(sr * 2);
      for (let i = 0; i < sr; i++) {
        const v = 0.7 * gain * Math.sin((2 * Math.PI * f * i) / sr + 0.7);
        x[2 * i] = v;
        x[2 * i + 1] = 0.5 * v;
      }
      const r = limitar(x, 2, sr);
      expect(picoVerdaderoDb(x, 2, 8), `ganancia ${gain}`).toBeLessThanOrEqual(-0.99);
      if (gain >= 2) expect(r.reduccionMaxDb).toBeGreaterThan(0);
    }
  });

  it('no toca lo que ya cabe y no retrasa ni una muestra', () => {
    const x = new Float32Array(sr * 2);
    for (let i = 0; i < x.length; i++) x[i] = 0.3 * Math.sin(i * 0.01);
    const copia = x.slice();
    const r = limitar(x, 2, sr);
    expect(r.reduccionMaxDb).toBe(0);
    expect(Buffer.from(x.buffer).equals(Buffer.from(copia.buffer))).toBe(true);
    // Con un impulso fuerte, la posición del pico no se mueve (fase cero).
    const y = new Float32Array(sr);
    y[24000] = 1.8;
    y[24001] = 1.8;
    limitar(y, 1, sr);
    let k = 0;
    for (let i = 0; i < y.length; i++) if (Math.abs(y[i]) > Math.abs(y[k])) k = i;
    expect([24000, 24001]).toContain(k);
    expect(picoVerdaderoDb(y, 1, 8)).toBeLessThanOrEqual(-0.99);
  });

  it('recupera la ganancia después del pico (release) y no deja la pista abajo', () => {
    const x = new Float32Array(sr * 3);
    for (let i = 0; i < x.length; i++) x[i] = 0.3 * Math.sin(i * 0.05);
    for (let i = 0; i < 100; i++) x[sr + i] = 1.6 * Math.sin(i * 0.05);
    limitar(x, 1, sr);
    // Dos segundos después del golpe el nivel volvió al original (0,3).
    let pico = 0;
    for (let i = 2 * sr + 1000; i < 2 * sr + 3000; i++) pico = Math.max(pico, Math.abs(x[i]));
    expect(pico).toBeGreaterThan(0.29);
  });
});

describe('sonoridad integrada', () => {
  it('los filtros K a 48 kHz son los de la recomendación', () => {
    const [shelf, hp] = filtrosK(48000);
    expect(shelf.b[0]).toBeCloseTo(1.53512485958697, 6);
    expect(shelf.b[1]).toBeCloseTo(-2.69169618940638, 6);
    expect(shelf.a[0]).toBeCloseTo(-1.69065929318241, 6);
    expect(shelf.a[1]).toBeCloseTo(0.73248077421585, 6);
    expect(hp.a[0]).toBeCloseTo(-1.99004745483398, 6);
    expect(hp.a[1]).toBeCloseTo(0.99007225036621, 6);
  });

  it('un seno de 997 Hz a -20 dBFS en los dos canales mide -20 LUFS (referencia de la recomendación) y el silencio es -Infinity', () => {
    const x = new Float32Array(sr * 6);
    for (let i = 0; i < sr * 3; i++) x[2 * i] = x[2 * i + 1] = 0.1 * Math.sin((2 * Math.PI * 997 * i) / sr);
    expect(sonoridadIntegrada(x, sr, 2)).toBeCloseTo(-20 + 0.0, 0);
    expect(Math.abs(sonoridadIntegrada(x, sr, 2) - -20)).toBeLessThan(0.3);
    expect(sonoridadIntegrada(new Float32Array(sr * 4), sr, 2)).toBe(-Infinity);
  });

  it('la compuerta relativa ignora los tramos mudos', () => {
    const a = new Float32Array(sr * 2 * 3);
    for (let i = 0; i < sr * 3; i++) a[2 * i] = a[2 * i + 1] = 0.1 * Math.sin((2 * Math.PI * 997 * i) / sr);
    const conSilencio = new Float32Array(sr * 2 * 9);
    conSilencio.set(a);
    expect(Math.abs(sonoridadIntegrada(conSilencio, sr, 2) - sonoridadIntegrada(a, sr, 2))).toBeLessThan(0.3);
  });
});
