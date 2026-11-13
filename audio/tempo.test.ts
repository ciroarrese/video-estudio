// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { tempoReport, TEMPO_SR, estimateTempo } from './tempo';
import { pistaDeClics } from './pistas-de-prueba';

describe('tempo', () => {
  for (const bpm of [90, 120, 140]) {
    it(`estima ${bpm} BPM (±1) y coloca los pulsos sobre los clics`, () => {
      const x = pistaDeClics({ bpm, seconds: 20, sr: TEMPO_SR });
      const r = tempoReport(x, 30);
      expect(Math.abs(r.bpm - bpm)).toBeLessThanOrEqual(1);
      expect(r.confidence).toBeGreaterThan(0.5);
      // Cada pulso de la grilla cae a menos de 25 ms de un clic real.
      const per = 60 / bpm;
      for (const t of r.beatsSec.slice(0, 20)) {
        const d = Math.abs(t / per - Math.round(t / per)) * per;
        expect(d).toBeLessThan(0.025);
      }
      expect(r.beatFrames[1] - r.beatFrames[0]).toBeCloseTo((30 * 60) / bpm, 0);
    });
  }

  it('encuentra la entrada de la percusión tras 4 s de colchón', () => {
    const x = pistaDeClics({ bpm: 120, seconds: 16, sr: TEMPO_SR, padSec: 4 });
    const r = tempoReport(x, 30);
    expect(Math.abs(r.bpm - 120)).toBeLessThanOrEqual(1);
    expect(r.percussionStart).not.toBeNull();
    expect(Math.abs(r.percussionStart!.sec - 4)).toBeLessThan(0.05);
    expect(Math.abs(r.percussionBeat!.sec - 4)).toBeLessThan(0.03);
  });

  it('una pista sin percusión no devuelve inicio de percusión', () => {
    const x = pistaDeClics({ bpm: 120, seconds: 10, sr: TEMPO_SR, padSec: 10, clicksHasta: 0 });
    expect(estimateTempo(x).percussionStartSec).toBeNull();
  });

  it('--bpm y --offset a mano fijan la grilla', () => {
    const x = pistaDeClics({ bpm: 100, seconds: 10, sr: TEMPO_SR });
    const r = tempoReport(x, 30, { bpm: 100, offsetSec: 0.1 });
    expect(r.manual).toBe(true);
    expect(r.bpm).toBe(100);
    expect(r.beatsSec[0]).toBeCloseTo(0.1, 3);
    expect(r.beatsSec[1]).toBeCloseTo(0.7, 3);
  });
});
