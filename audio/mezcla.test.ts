// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodificar, escribirWav16, hayFfmpeg } from './ffmpeg';
import { EFECTOS, generarEfectos } from './efectos';
import { mezclar, planMezcla, rutaDeEfecto } from './mezcla';

describe('planMezcla', () => {
  it('convierte cuadros a muestras exactas y arma un filtro por cue', () => {
    const p = planMezcla({
      fps: 30,
      durationFrames: 300,
      cues: [
        { frame: 45, sfx: 'clic' },
        { frame: 90, sfx: 'tilde', gain: 0.5 },
      ],
    });
    expect(p.cueSamples).toEqual([72000, 144000]);
    expect(p.totalSamples).toBe(480000);
    expect(p.inputs).toEqual(['public/sfx/clic.wav', 'public/sfx/tilde.wav']);
    expect(p.filterComplex).toContain('adelay=72000S:all=1');
    expect(p.filterComplex).toContain('volume=0.5');
    expect(p.filterComplex).toContain('amix=inputs=2:normalize=0');
    expect(p.filterComplex).not.toContain('sidechaincompress');
  });

  it('con música agrega ducking por sidechain y la música es la entrada 0', () => {
    const p = planMezcla({ fps: 30, durationFrames: 90, cues: [{ frame: 10, sfx: 'golpe' }], musica: { archivo: 'm.wav', gain: 0.4, desdeSec: 2 } });
    expect(p.inputs[0]).toBe('m.wav');
    expect(p.filterComplex).toContain('atrim=start=2');
    expect(p.filterComplex).toContain('sidechaincompress');
    const sin = planMezcla({ fps: 30, durationFrames: 90, cues: [{ frame: 10, sfx: 'golpe' }], musica: { archivo: 'm.wav' }, duck: { ratio: 0 } });
    expect(sin.filterComplex).not.toContain('sidechaincompress');
  });

  it('omite cues fuera del video y valida entradas', () => {
    const p = planMezcla({ fps: 30, durationFrames: 60, cues: [{ frame: 10, sfx: 'clic' }, { frame: 60, sfx: 'clic' }] });
    expect(p.inputs).toHaveLength(1);
    expect(p.advertencias).toHaveLength(1);
    expect(() => planMezcla({ fps: 30, durationFrames: 60, cues: [] })).toThrow();
    expect(() => planMezcla({ fps: 30, durationFrames: 60, cues: [{ frame: -1, sfx: 'clic' }] })).toThrow();
  });

  it('resuelve nombres y rutas', () => {
    expect(rutaDeEfecto('tilde', 'x')).toBe('x/tilde.wav');
    expect(rutaDeEfecto('otra/cosa.wav', 'x')).toBe('otra/cosa.wav');
  });
});

const HAY_FFMPEG = hayFfmpeg();
if (!HAY_FFMPEG) console.warn('[audio] ffmpeg no está en el PATH: se omiten las pruebas de punta a punta de mezcla.');

describe.skipIf(!HAY_FFMPEG)('efectos y mezcla (e2e con ffmpeg)', () => {
  it('los efectos son deterministas, no vacíos y sin saturar', () => {
    for (const [nombre, e] of Object.entries(EFECTOS)) {
      const a = e.generar(48000);
      const b = e.generar(48000);
      expect(Buffer.from(a.buffer).equals(Buffer.from(b.buffer)), nombre).toBe(true);
      const pico = a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(pico, nombre).toBeGreaterThan(0.3);
      expect(pico, nombre).toBeLessThanOrEqual(0.9);
    }
  });

  it('el pico de energía de cada cue cae en su cuadro (±1) y la duración es la del video', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      const sfxDir = join(dir, 'sfx');
      generarEfectos(sfxDir);
      const fps = 30;
      const salida = join(dir, 'mezcla.wav');
      // Música: un tono constante, para comprobar también la mezcla con ducking.
      const musica = join(dir, 'musica.wav');
      const tono = new Float32Array(48000 * 6);
      for (let i = 0; i < tono.length; i++) tono[i] = 0.2 * Math.sin((2 * Math.PI * 220 * i) / 48000);
      escribirWav16(musica, tono, 48000, 1);

      const cues = [
        { frame: 45, sfx: 'clic', gain: 1 },
        { frame: 120, sfx: 'clic', gain: 0.7 },
      ];
      await mezclar({ fps, durationFrames: 180, cues, sfxDir, salida, musica: { archivo: musica, gain: 0.3 }, duck: { ratio: 4 } });
      const y = await decodificar(salida, { sr: 48000, canales: 1 });
      expect(Math.abs(y.length / 48000 - 180 / fps)).toBeLessThanOrEqual(1 / fps);

      for (const c of cues) {
        const ini = Math.round((c.frame / fps) * 48000);
        // Mayor energía (ventana de 2 ms) dentro de ±0,25 s del cue: tiene que estar en su cuadro.
        const v = Math.round(0.002 * 48000);
        let mejor = { i: 0, e: -1 };
        for (let i = ini - 12000; i < ini + 12000 - v; i += v) {
          let e = 0;
          for (let j = 0; j < v; j++) e += y[i + j] ** 2;
          if (e > mejor.e) mejor = { i, e };
        }
        expect(Math.abs(mejor.i - ini) / 48000).toBeLessThanOrEqual(1 / fps);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
