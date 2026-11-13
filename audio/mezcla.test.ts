// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodificar, escribirWav16, hayFfmpeg } from './ffmpeg';
import { EFECTOS, generarEfectos } from './efectos';
import { picoVerdaderoDb, rmsDb } from './medidas';
import { mezclar, planMezcla, rutaDeEfecto, ventanasDeDucking } from './mezcla';
import { sonoridadIntegrada } from './sonoridad';

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
    expect(p.efectoSamples).toEqual([72000, 144000]);
    expect(p.totalSamples).toBe(480000);
    expect(p.inputs).toEqual(['public/sfx/clic.wav', 'public/sfx/tilde.wav']);
    expect(p.filterComplex).toContain('adelay=72000S:all=1');
    expect(p.filterComplex).toContain('volume=0.5');
    expect(p.filterComplex).toContain('amix=inputs=2:normalize=0');
    expect(p.stems).toBe('sfx');
    expect(p.filterComplex).not.toContain('alimiter');
  });

  it('con música entrega música y efectos por separado (4 canales) para aplicar el ducking en memoria', () => {
    const p = planMezcla({ fps: 30, durationFrames: 90, cues: [{ frame: 10, sfx: 'golpe' }], musica: { archivo: 'm.wav', gain: 0.4, desdeSec: 2 } });
    expect(p.inputs[0]).toBe('m.wav');
    expect(p.filterComplex).toContain('atrim=start=2');
    expect(p.stems).toBe('ambos');
    expect(p.filterComplex).toContain('amerge=inputs=2');
    expect(p.filterComplex).not.toContain('sidechaincompress');
    expect(planMezcla({ fps: 30, durationFrames: 90, cues: [], musica: { archivo: 'm.wav' } }).stems).toBe('musica');
  });

  it('omite cues fuera del video y valida entradas', () => {
    const p = planMezcla({ fps: 30, durationFrames: 60, cues: [{ frame: 10, sfx: 'clic' }, { frame: 60, sfx: 'clic' }] });
    expect(p.inputs).toHaveLength(1);
    expect(p.advertencias).toHaveLength(1);
    expect(() => planMezcla({ fps: 30, durationFrames: 60, cues: [] })).toThrow();
    expect(() => planMezcla({ fps: 30, durationFrames: 60, cues: [{ frame: -1, sfx: 'clic' }] })).toThrow();
    expect(() => planMezcla({ fps: 30, durationFrames: 60, cues: [{ frame: 1, sfx: 'clic', ancla: 'medio' as never }] })).toThrow(/ancla/);
  });

  it('resuelve nombres y rutas', () => {
    expect(rutaDeEfecto('tilde', 'x')).toBe('x/tilde.wav');
    expect(rutaDeEfecto('otra/cosa.wav', 'x')).toBe('otra/cosa.wav');
  });

  it('ancla "pico" adelanta el efecto lo que tarda en llegar a su pico; un efecto mono se duplica sin perder 3 dB', () => {
    const p = planMezcla(
      { fps: 30, durationFrames: 120, cues: [{ frame: 60, sfx: 'barrido', ancla: 'pico' }, { frame: 1, sfx: 'tilde', ancla: 'pico' }] },
      { 'public/sfx/barrido.wav': { canales: 1, picoSamples: 18480 }, 'public/sfx/tilde.wav': { canales: 2, picoSamples: 4560 } },
    );
    expect(p.cueSamples).toEqual([96000, 1600]);
    expect(p.efectoSamples).toEqual([96000 - 18480, 0]);
    expect(p.filterComplex).toContain('adelay=77520S');
    // El segundo arranca antes del inicio del video: se le recorta el comienzo.
    expect(p.filterComplex).toContain('atrim=start_sample=2960');
    expect(p.filterComplex).toContain('pan=stereo|c0=c0|c1=c0');
  });
});

describe('ventanasDeDucking', () => {
  it('profundidad fija, sin ducking bajo la ganancia mínima, escalable por ganancia y apagable', () => {
    const cues = [{ frame: 1, sfx: 'a', gain: 1 }, { frame: 2, sfx: 'a', gain: 0.5 }, { frame: 3, sfx: 'a', gain: 0.05 }];
    const plan = { efectoSamples: [100, 200, 300] };
    const w = ventanasDeDucking(cues, plan, [1000, 1000, 1000]);
    expect(w.map((v) => v.profundidadDb)).toEqual([5, 5]); // el de 0,05 no baja la música
    expect(w[0]).toEqual({ iniSample: 100, finSample: 1100, profundidadDb: 5 });
    expect(ventanasDeDucking(cues, plan, [1000, 1000, 1000], { db: 8, escalaGain: true }).map((v) => v.profundidadDb)).toEqual([8, 4]);
    expect(ventanasDeDucking(cues, plan, [1000, 1000, 1000], { db: 0 })).toEqual([]);
    expect(ventanasDeDucking(cues, plan, [1000, 1000, 1000], { ratio: 0 })).toEqual([]);
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
  }, 60000);
});

const SR = 48000;

/** Canal izquierdo de un archivo de audio. */
async function izquierdo(archivo: string): Promise<Float32Array> {
  const y = await decodificar(archivo, { sr: SR, canales: 2 });
  const m = new Float32Array(y.length / 2);
  for (let i = 0; i < m.length; i++) m[i] = y[2 * i];
  return m;
}

/** Ráfaga de seno de `dur` s con ataque de 5 ms. */
function rafaga(f: number, dur: number, amp: number): Float32Array {
  const x = new Float32Array(Math.round(dur * SR));
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = amp * Math.sin(2 * Math.PI * f * t) * Math.min(1, t / 0.005) * Math.min(1, (dur - t) / 0.005);
  }
  return x;
}

describe.skipIf(!HAY_FFMPEG)('mezcla: ducking, retardo, pico verdadero y sonoridad (e2e)', () => {
  const tono = (seg: number, amp = 0.2) => {
    const t = new Float32Array(SR * seg);
    for (let i = 0; i < t.length; i++) t[i] = amp * Math.sin((2 * Math.PI * 220 * i) / SR);
    return t;
  };

  it('el ducking baja la música lo que pide --duck-db (±1 dB) sin importar el nivel del efecto, y se recupera en release + 100 ms', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      escribirWav16(join(dir, 'musica.wav'), tono(8), SR, 1);
      escribirWav16(join(dir, 'suave.wav'), rafaga(1500, 0.4, 0.1), SR, 1);
      escribirWav16(join(dir, 'fuerte.wav'), rafaga(1500, 0.4, 0.6), SR, 1);
      const fps = 30;
      const base = { fps, durationFrames: 240, sfxDir: dir };
      const cues = [{ frame: 60, sfx: 'suave' }, { frame: 150, sfx: 'fuerte' }, { frame: 200, sfx: 'suave', gain: 0.02 }];
      const musica = { archivo: join(dir, 'musica.wav'), gain: 1, fadeOutSec: 0 };
      await mezclar({ ...base, cues, salida: join(dir, 'a.wav'), musica });
      await mezclar({ ...base, cues, salida: join(dir, 'solo-sfx.wav') });
      await mezclar({ ...base, cues: [], salida: join(dir, 'solo-musica.wav'), musica });
      const [mezcla, sfx, mus] = await Promise.all(['a.wav', 'solo-sfx.wav', 'solo-musica.wav'].map((f) => izquierdo(join(dir, f))));
      const resto = Float32Array.from(mezcla, (v, i) => v - sfx[i]);
      const reduccion = (t0: number, t1: number) => rmsDb(mus, Math.round(t0 * SR), Math.round((t1 - t0) * SR)) - rmsDb(resto, Math.round(t0 * SR), Math.round((t1 - t0) * SR));
      // Debajo de cada efecto (de 30 ms después del inicio a 30 ms antes del fin): 5 dB, el efecto suave igual que el fuerte.
      for (const c of [2.0, 5.0]) expect(Math.abs(reduccion(c + 0.03, c + 0.37) - 5), `cue en ${c} s`).toBeLessThan(1);
      // Recuperación: a release (250 ms) + 100 ms de terminar el efecto, ya está a menos de 1 dB.
      for (const c of [2.0, 5.0]) expect(reduccion(c + 0.4 + 0.35, c + 0.4 + 0.45)).toBeLessThan(1);
      // Y antes del efecto no hay bajada.
      expect(reduccion(1.0, 1.9)).toBeLessThan(0.3);
      // Un cue con ganancia por debajo del mínimo no baja la música.
      expect(Math.abs(reduccion(6.7 + 0.03, 6.7 + 0.37))).toBeLessThan(0.5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('el limitador no retrasa nada: un impulso cae en la muestra exacta del cue, con y sin música', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      const imp = new Float32Array(2400);
      imp[0] = 0.5;
      escribirWav16(join(dir, 'impulso.wav'), imp, SR, 1);
      escribirWav16(join(dir, 'musica.wav'), tono(3, 0.05), SR, 1);
      for (const conMusica of [false, true]) {
        const salida = join(dir, `s${conMusica}.wav`);
        const plan = await mezclar({ fps: 30, durationFrames: 90, cues: [{ frame: 45, sfx: 'impulso' }], sfxDir: dir, salida, musica: conMusica ? { archivo: join(dir, 'musica.wav') } : undefined });
        const y = await izquierdo(salida);
        let k = 0;
        for (let i = 0; i < y.length; i++) if (Math.abs(y[i]) > Math.abs(y[k])) k = i;
        expect(k).toBe(plan.cueSamples[0]);
        expect(plan.cueSamples[0]).toBe(72000);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('una mezcla muy caliente sale con pico verdadero <= -1 dBTP (sobremuestreo x8) a cualquier ganancia', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      // Seno cerca de la frecuencia de Nyquist/4 muestreado de forma que las crestas entre muestras superan a las muestras.
      const f = 11025 / 2 + 70;
      const x = new Float32Array(SR);
      for (let i = 0; i < x.length; i++) x[i] = 0.99 * Math.sin((2 * Math.PI * f * i) / SR + 0.7) * Math.min(1, i / 200);
      escribirWav16(join(dir, 'fuerte.wav'), x, SR, 1);
      for (const gain of [1, 3, 8]) {
        const salida = join(dir, `h${gain}.wav`);
        const plan = await mezclar({ fps: 30, durationFrames: 30, cues: [{ frame: 0, sfx: 'fuerte', gain }, { frame: 1, sfx: 'fuerte', gain }], sfxDir: dir, salida });
        const y = await decodificar(salida, { sr: SR, canales: 2 });
        expect(picoVerdaderoDb(y, 2, 8), `gain ${gain}`).toBeLessThanOrEqual(-0.99);
        expect(plan.info.reduccionLimitadorDb).toBeGreaterThan(0);
        expect(plan.info.picoVerdaderoDbtp).toBeLessThanOrEqual(-0.99);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('--lufs lleva la sonoridad integrada al objetivo (±0,5 LU) y mide igual que ffmpeg ebur128', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      escribirWav16(join(dir, 'musica.wav'), tono(8, 0.05), SR, 1);
      escribirWav16(join(dir, 'clic.wav'), rafaga(2000, 0.05, 0.3), SR, 1);
      const base = { fps: 30, durationFrames: 240, cues: [{ frame: 60, sfx: 'clic' }], sfxDir: dir, musica: { archivo: join(dir, 'musica.wav'), gain: 1, fadeOutSec: 0 } };
      const sin = await mezclar({ ...base, salida: join(dir, 'sin.wav') });
      expect(sin.info.gananciaLufsDb).toBe(0);
      for (const objetivo of [-23, -16]) {
        const salida = join(dir, `l${-objetivo}.wav`);
        const plan = await mezclar({ ...base, salida, lufs: objetivo });
        const y = await decodificar(salida, { sr: SR, canales: 2 });
        expect(Math.abs(sonoridadIntegrada(y, SR, 2) - objetivo)).toBeLessThan(0.5);
        const r = spawnSync('ffmpeg', ['-nostats', '-i', salida, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
        const m = /I:\s+(-?[\d.]+) LUFS/.exec(r.stderr.slice(r.stderr.lastIndexOf('Summary')));
        expect(m).not.toBeNull();
        expect(Math.abs(Number(m![1]) - sonoridadIntegrada(y, SR, 2))).toBeLessThan(0.3);
        expect(plan.info.lufsFinal).not.toBeNull();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('ancla "pico": el pico audible del efecto cae en el cuadro del cue; un efecto mono no pierde 3 dB', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      // Efecto mono con su pico 0,2 s después del inicio.
      const x = new Float32Array(Math.round(0.6 * SR));
      const g = rafaga(1000, 0.1, 0.5).map((v, i, a) => v * Math.sin((Math.PI * i) / a.length) ** 2); // pico en el centro
      x.set(g, Math.round(0.15 * SR));
      escribirWav16(join(dir, 'tarde.wav'), x, SR, 1);
      const fps = 30;
      const sal = (n: string) => join(dir, n);
      const p1 = await mezclar({ fps, durationFrames: 90, cues: [{ frame: 45, sfx: 'tarde' }], sfxDir: dir, salida: sal('i.wav') });
      const p2 = await mezclar({ fps, durationFrames: 90, cues: [{ frame: 45, sfx: 'tarde', ancla: 'pico' }], sfxDir: dir, salida: sal('p.wav') });
      const centro = (y: Float32Array) => {
        // Centro de energía de la ráfaga (ventanas de 10 ms).
        let mejor = { i: 0, e: -1 };
        const w = Math.round(0.01 * SR);
        for (let i = 0; i + w < y.length; i += w) {
          let e = 0;
          for (let j = 0; j < w; j++) e += y[i + j] ** 2;
          if (e > mejor.e) mejor = { i: i + w / 2, e };
        }
        return mejor.i;
      };
      const yi = await izquierdo(sal('i.wav'));
      const yp = await izquierdo(sal('p.wav'));
      const cue = p1.cueSamples[0];
      expect(Math.abs(centro(yi) - cue - 0.2 * SR)).toBeLessThan(0.02 * SR); // con "inicio", el pico llega 0,2 s después
      expect(Math.abs(centro(yp) - cue)).toBeLessThan(0.02 * SR); // con "pico", cae en el cuadro
      expect(p2.efectoSamples[0]).toBeLessThan(cue);
      // Mono: el pico del canal es el del archivo (0,5), no 0,35.
      expect(yi.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeGreaterThan(0.45);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('un efecto que no existe falla de entrada nombrando el cue', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      escribirWav16(join(dir, 'tilde.wav'), rafaga(1000, 0.1, 0.5), SR, 1);
      await expect(mezclar({ fps: 30, durationFrames: 60, cues: [{ frame: 5, sfx: 'tilde' }, { frame: 20, sfx: 'no-existe' }], sfxDir: dir, salida: join(dir, 'x.wav') })).rejects.toThrow(/cue 2 \(cuadro 20, sfx "no-existe"\)/);
      expect(existsSync(join(dir, 'x.wav'))).toBe(false);
      await expect(mezclar({ fps: 30, durationFrames: 60, cues: [], musica: { archivo: join(dir, 'nada.wav') }, salida: join(dir, 'x.wav') })).rejects.toThrow(/música/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
