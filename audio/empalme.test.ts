// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { empalmar, planEmpalme, renderizarPlan } from './empalme';
import { decodificar, escribirWav16 } from './ffmpeg';
import { aEstereo, pistaDeClics } from './pistas-de-prueba';
import { beatGrid, tempoReport, TEMPO_SR } from './tempo';

const grilla = (bpm: number, off: number, dur: number) => beatGrid(bpm, off, dur);

describe('planEmpalme', () => {
  it('recorta sin empalmes si la pista alcanza', () => {
    const p = planEmpalme({ beatsSec: grilla(120, 0, 30), trackDurSec: 30, targetSec: 10 });
    expect(p.splices).toEqual([]);
    expect(p.segments).toHaveLength(1);
    expect(p.fadeOut).toEqual({ startSec: 8, durSec: 2 });
  });

  it('repite compases enteros: cada empalme cae sobre un pulso de la salida', () => {
    // 120 BPM => pulso cada 0,5 s; compás de 4 = 2 s; pista de 9,3 s desde el pulso en 1,0 s.
    const beats = grilla(120, 0, 9.3);
    const p = planEmpalme({ beatsSec: beats, trackDurSec: 9.3, targetSec: 30, startSec: 1.02 });
    expect(p.startSec).toBe(1);
    // Compases enteros desde 1,0: cierra en 9,0 (margen para el cruce) => bucle de 8 s.
    expect(p.loopEndSec).toBe(9);
    expect(p.splices.length).toBe(3);
    for (const sp of p.splices) expect((sp.outSec / 0.5) % 4).toBeCloseTo(0, 6);
    for (const b of p.outBeatsSec) expect(b / 0.5).toBeCloseTo(Math.round(b / 0.5), 6);
    expect(p.segments.reduce((a, s) => a + s.lenSec, 0)).toBeCloseTo(30, 6);
  });

  it('absorbe un resto cortísimo en el tramo anterior', () => {
    const p = planEmpalme({ beatsSec: grilla(120, 0, 8.3), trackDurSec: 8.3, targetSec: 16.1 });
    expect(p.segments.reduce((a, s) => a + s.lenSec, 0)).toBeCloseTo(16.1, 6);
    expect(p.segments.length).toBe(2);
  });

  it('falla si no hay pulsos', () => {
    expect(() => planEmpalme({ beatsSec: [1], trackDurSec: 5, targetSec: 3 })).toThrow();
  });
});

describe('renderizarPlan', () => {
  it('conserva el largo y el cruce es de potencia constante', () => {
    const sr = 8000;
    const x = aEstereo(new Float32Array(sr * 4).fill(0.5));
    const plan = planEmpalme({ beatsSec: grilla(120, 0, 4), trackDurSec: 4, targetSec: 9, crossfadeSec: 0.04, fadeOutSec: 0.5 });
    const y = renderizarPlan(x, plan, sr, sr * 9);
    expect(y.length).toBe(sr * 9 * 2);
    // Fuera de cruces y de la caída final, la señal constante sigue constante.
    expect(y[sr * 2 * 3]).toBeCloseTo(0.5, 3);
  });
});

describe('empalmar (e2e con ffmpeg)', () => {
  it('arma 25 s desde una pista de 12 s con colchón: duración exacta y empalmes en pulso', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      const sr = 48000;
      const entrada = join(dir, 'pista.wav');
      const salida = join(dir, 'salida.wav');
      // 120 BPM, 4 s de colchón y clics desde 4 s hasta 16 s.
      escribirWav16(entrada, pistaDeClics({ bpm: 120, seconds: 16, sr, padSec: 4 }), sr, 1);
      const mono = await decodificar(entrada, { sr: TEMPO_SR, canales: 1 });
      const t = tempoReport(mono, 30);
      const fps = 30;
      const frames = 25 * fps;
      const r = await empalmar({ entrada, salida, fps, frames, beatsSec: t.beatsSec, startSec: t.percussionBeat!.sec, fadeOutSec: 1 });
      expect(r.plan.splices.length).toBeGreaterThanOrEqual(1);

      const y = await decodificar(salida, { sr, canales: 1 });
      expect(Math.abs(y.length / sr - frames / fps)).toBeLessThanOrEqual(1 / fps);

      // Picos de clic en la salida (se ignora el colchón: amplitud < 0,3).
      const picos: number[] = [];
      for (let i = 0; i < y.length; i++) {
        if (Math.abs(y[i]) > 0.3 && (picos.length === 0 || i / sr - picos[picos.length - 1] > 0.2)) picos.push(i / sr);
      }
      // Toda la entrada de clics queda en la grilla de pulsos de la salida (±15 ms).
      const per = 60 / t.bpm;
      expect(picos.length).toBeGreaterThan(30);
      for (const p of picos.slice(0, -2)) {
        const k = p / per;
        expect(Math.abs(k - Math.round(k)) * per).toBeLessThan(0.02);
      }
      // Los empalmes del plan caen sobre pulsos de salida.
      for (const sp of r.plan.splices) expect(r.plan.outBeatsSec.some((b) => Math.abs(b - sp.outSec) < 1e-6)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
