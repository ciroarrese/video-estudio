// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { avisoDeFase, detectarSecciones, estimateTempo, onsetEnvelope, percussionStart, pulsoMasCercano, tempoReport, TEMPO_SR } from './tempo';
import { pistaDeBateria, pistaDeClics } from './pistas-de-prueba';

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

  it('la fase no salta medio pulso según el largo del tramo (bombo en el pulso, platillos más fuertes en las corcheas)', () => {
    for (const bpm of [100, 107, 120]) {
      const per = 60 / bpm;
      for (const seg of [8, 12, 16, 24, 40, 60]) {
        const x = pistaDeBateria({ bpm, seconds: seg, sr: TEMPO_SR, offsetSec: 0.1 });
        const r = estimateTempo(x);
        const d = (((r.offsetSec - 0.1) % per) + per) % per;
        // Dentro de 20 ms del pulso verdadero (y no en el contratiempo, a medio pulso).
        expect(Math.min(d, per - d), `${bpm} bpm, ${seg} s`).toBeLessThan(0.02);
        expect(r.phaseConfidence).toBeGreaterThan(0.05);
      }
    }
  });

  it('--fase medio corre la grilla medio pulso y la fase alternativa coincide', () => {
    const x = pistaDeBateria({ bpm: 100, seconds: 30, sr: TEMPO_SR, offsetSec: 0.1 });
    const a = tempoReport(x, 30);
    const b = tempoReport(x, 30, { fase: 'medio' });
    const per = 0.6;
    expect(b.faseMedio).toBe(true);
    expect(Math.abs(((b.beatsSec[0] - a.beatsSec[0] + per) % per) - per / 2)).toBeLessThan(0.005);
    expect(estimateTempo(x).offsetAltSec).toBeCloseTo(b.beatsSec[0], 2);
    expect(avisoDeFase({ phaseConfidence: 0.02, manual: false, faseMedio: false })).toMatch(/--fase medio/);
    expect(avisoDeFase({ phaseConfidence: 0.5, manual: false, faseMedio: false })).toBeUndefined();
    expect(avisoDeFase({ phaseConfidence: 0.02, manual: true, faseMedio: false })).toBeUndefined();
  });

  it('con --offset a mano la fase no se juzga', () => {
    const x = pistaDeBateria({ bpm: 100, seconds: 20, sr: TEMPO_SR });
    expect(estimateTempo(x, TEMPO_SR, { offsetSec: 0.37 }).phaseConfidence).toBe(1);
  });

  it('el inicio de la percusión no cambia si se recorta el final (umbral por percentil, no por el máximo)', () => {
    // Un colchón de 4 s, clics suaves desde 4 s y desde 20 s clics fuertes; al final un golpe aislado muy fuerte
    // (con el umbral en 0,3 del máximo, recortar el final movía el inicio de 20 s a 4,5 s).
    const sr = TEMPO_SR;
    const x = pistaDeClics({ bpm: 120, seconds: 40, sr, padSec: 4, amplitud: 0.1 });
    const fuerte = pistaDeClics({ bpm: 120, seconds: 40, sr, padSec: 4, amplitud: 0.9 });
    for (let i = 20 * sr; i < x.length; i++) x[i] = fuerte[i];
    const aislado = x.slice();
    for (let j = 0; j < 0.05 * sr; j++) aislado[Math.round(39.2 * sr) + j] += 10 * Math.sin((2 * Math.PI * 1500 * j) / sr) * Math.exp(-j / sr / 0.01);
    const largo = percussionStart(onsetEnvelope(aislado));
    const corto = percussionStart(onsetEnvelope(aislado.slice(0, 38 * sr)));
    expect(largo).not.toBeNull();
    expect(corto).not.toBeNull();
    expect(Math.abs(largo! - corto!)).toBeLessThan(0.05);
  });

  it('detecta los cambios de sección: entrada tras un tramo casi mudo, subida de percusión y caída', () => {
    const sr = TEMPO_SR;
    // 0 a 8 s casi mudo; 8 a 24 s colchón y clics suaves poco densos (1 por segundo, flojos); 24 a 48 s clics a 120 BPM fuertes; 48 a 56 s silencio.
    const x = new Float32Array(56 * sr);
    const colchon = pistaDeClics({ bpm: 120, seconds: 56, sr, padSec: 0.001, amplitud: 0.0 });
    for (let i = 0; i < x.length; i++) x[i] = 0.0005 * colchon[i];
    for (let i = 8 * sr; i < 48 * sr; i++) x[i] += 0.05 * Math.sin((2 * Math.PI * 220 * i) / sr);
    const fuertes = pistaDeClics({ bpm: 120, seconds: 56, sr, amplitud: 0.9 });
    const suaves = pistaDeClics({ bpm: 60, seconds: 56, sr, amplitud: 0.35 });
    for (let i = 8 * sr; i < 24 * sr; i++) x[i] += suaves[i];
    for (let i = 24 * sr; i < 48 * sr; i++) x[i] += fuertes[i];
    const sec = detectarSecciones(x, onsetEnvelope(x));
    const tipos = sec.map((c) => c.tipo);
    expect(tipos[0]).toBe('entrada');
    expect(Math.abs(sec[0].sec - 8)).toBeLessThan(1.5);
    expect(sec.some((c) => c.tipo === 'caida' && Math.abs(c.sec - 48) < 3)).toBe(true);
    expect(sec.some((c) => (c.tipo === 'percusion' || c.tipo === 'energia') && Math.abs(c.sec - 24) < 3)).toBe(true);
  });

  it('el reporte numera las secciones desde 1 y pulsoMasCercano ajusta al pulso', () => {
    const x = pistaDeClics({ bpm: 120, seconds: 20, sr: TEMPO_SR, padSec: 6 });
    const r = tempoReport(x, 30);
    r.secciones.forEach((c, i) => expect(c.n).toBe(i + 1));
    expect(pulsoMasCercano([0, 0.5, 1, 1.5], 0.8)).toBe(1);
  });
});

