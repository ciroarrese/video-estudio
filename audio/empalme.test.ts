// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chequearConfianza } from './tempo';
import { aplicarHeadroom, empalmar, muestrasDelPlan, planEmpalme, renderizarPlan } from './empalme';
import { codificar, decodificar, escribirWav16, hayFfmpeg } from './ffmpeg';
import { detectarCuerpo } from './cuerpo';
import { aEstereo, conCaidaEnDb, pistaDeClics } from './pistas-de-prueba';
import { escalonRmsDb } from './medidas';
import { beatGrid, tempoReport, TEMPO_SR } from './tempo';

const HAY_FFMPEG = hayFfmpeg();
if (!HAY_FFMPEG) console.warn('[audio] ffmpeg no está en el PATH: se omiten las pruebas de punta a punta de empalme.');

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

describe('planEmpalme: empalmes sin saltos', () => {
  it('con pulsos sin redondear, el final de cada tramo es el inicio del siguiente (fps y bpm variados)', () => {
    const sr = 48000;
    let planes = 0;
    for (const fps of [30, 29.97, 60]) {
      for (let bpm = 70; bpm <= 180; bpm += 2.37) {
        const off = 0.123456789 + bpm / 1000;
        const dur = 14.3171;
        const per = 60 / bpm;
        // Pulsos sin redondear a 1e-6.
        const beats: number[] = [];
        for (let k = 0; off + k * per <= dur; k++) beats.push(off + k * per);
        const frames = Math.round(180 * fps);
        const target = frames / fps;
        const plan = planEmpalme({ beatsSec: beats, trackDurSec: dur, targetSec: target });
        const total = Math.round(target * sr);
        const m = muestrasDelPlan(plan, sr, total);
        for (let i = 0; i + 1 < m.length; i++) expect(m[i].o1, `fps ${fps} bpm ${bpm} tramo ${i}`).toBe(m[i + 1].o0);
        // Cada empalme tiene su cruce registrado en la muestra exacta donde empieza el tramo siguiente.
        for (let i = 1; i < m.length; i++) expect(Math.round(plan.splices[i - 1].outSec * sr)).toBe(m[i].o0);
        planes++;
      }
    }
    expect(planes).toBeGreaterThan(100);
  });
});

describe('planEmpalme: resto corto', () => {
  it('no lee más allá del final de la pista cuando absorbería el resto', () => {
    // 120 BPM; la pista termina justo en el último pulso útil (8,02 s => bucle hasta 8,0).
    const dur = 8.02;
    const beats = grilla(120, 0, dur);
    const p = planEmpalme({ beatsSec: beats, trackDurSec: dur, targetSec: 16.1 });
    expect(p.loopEndSec).toBe(8);
    expect(p.segments.reduce((a, s) => a + s.lenSec, 0)).toBeCloseTo(16.1, 6);
    for (const sg of p.segments) expect(sg.srcStart + sg.lenSec).toBeLessThanOrEqual(dur + 1e-9);
  });

  it('absorbe el resto si la pista alcanza a darlo', () => {
    const p = planEmpalme({ beatsSec: grilla(120, 0, 8.3), trackDurSec: 8.3, targetSec: 16.1 });
    expect(p.segments.length).toBe(2);
    for (const sg of p.segments) expect(sg.srcStart + sg.lenSec).toBeLessThanOrEqual(8.3 + 1e-9);
  });

  it('el audio del resto no sale en silencio (pista que termina justo en el fin del bucle)', () => {
    const sr = 8000;
    const dur = 8.02;
    const x = aEstereo(new Float32Array(Math.round(dur * sr)).fill(0.5));
    const plan = planEmpalme({ beatsSec: grilla(120, 0, dur), trackDurSec: dur, targetSec: 16.1, fadeOutSec: 0 });
    const y = renderizarPlan(x, plan, sr, Math.round(16.1 * sr));
    // Última décima de segundo (antes del fin): sigue habiendo señal.
    expect(y[(Math.round(16.1 * sr) - 100) * 2]).toBeGreaterThan(0.4);
  });
});

/** Pista de clics a 120 BPM con colchón, `dur` segundos, con una caída final de `cola` s (a -60 dB). Estéreo. */
function pistaConCola(dur: number, cola: number) {
  const mono = conCaidaEnDb(pistaDeClics({ bpm: 120, seconds: dur, sr: SR_P, padSec: 2 }), SR_P, dur - cola - 2, cola, -60);
  return { mono, estereo: aEstereo(mono), beats: grilla(120, 0, dur), dur };
}
const SR_P = 16000;

function monoDe(y: Float32Array): Float32Array {
  const m = new Float32Array(y.length / 2);
  for (let i = 0; i < m.length; i++) m[i] = y[2 * i];
  return m;
}

describe('empalme dentro del cuerpo de la pista (cola, intro baja, lazo a mano)', () => {
  it('con una caída final de 6 s el escalón de RMS del empalme es comparable al de cualquier pulso', () => {
    const p = pistaConCola(44, 6);
    const total = Math.round(100 * SR_P);
    const cuerpo = detectarCuerpo(p.mono, SR_P);
    const sinCuerpo = planEmpalme({ beatsSec: p.beats, trackDurSec: p.dur, targetSec: 100, fadeOutSec: 0, startSec: 2 });
    const conCuerpo = planEmpalme({ beatsSec: p.beats, trackDurSec: p.dur, targetSec: 100, fadeOutSec: 0, startSec: 2, cuerpo });
    const paso = (plan: ReturnType<typeof planEmpalme>) => {
      const y = monoDe(renderizarPlan(p.estereo, plan, SR_P, total));
      return Math.max(...plan.splices.map((sp) => escalonRmsDb(y, SR_P, sp.outSec, 0.5)));
    };
    // Un pulso cualquiera del cuerpo en la pista original, con las mismas ventanas.
    const comun = Math.max(...[10, 11, 12, 13.5, 20, 21.5].map((t) => escalonRmsDb(p.mono, SR_P, t, 0.5)));
    expect(conCuerpo.loopEndSec!).toBeLessThanOrEqual(cuerpo.finSec + 1e-6);
    // Antes (lazo hasta el último compás del archivo, dentro de la caída): salto de decenas de dB.
    expect(paso(sinCuerpo)).toBeGreaterThan(20);
    expect(paso(conCuerpo)).toBeLessThan(comun + 3);
  });

  it('una intro baja suena una sola vez: el lazo vuelve al comienzo del cuerpo', () => {
    const mono = pistaDeClics({ bpm: 120, seconds: 40, sr: SR_P, padSec: 2 });
    for (let i = 0; i < 6 * SR_P; i++) mono[i] *= 0.01;
    const cuerpo = detectarCuerpo(mono, SR_P);
    const plan = planEmpalme({ beatsSec: grilla(120, 0, 40), trackDurSec: 40, targetSec: 90, cuerpo });
    expect(plan.startSec).toBe(0);
    expect(plan.loopStartSec!).toBeGreaterThanOrEqual(cuerpo.inicioSec - 0.05);
    expect(plan.loopStartSec! % 2).toBeCloseTo(0, 6); // sobre un compás contado desde el inicio
    for (const sg of plan.segments.slice(1)) expect(sg.srcStart).toBeCloseTo(plan.loopStartSec!, 6);
  });

  it('--lazo-inicio y --lazo-fin ubican el lazo a mano, ajustados al compás', () => {
    const beats = grilla(120, 0, 60);
    const plan = planEmpalme({ beatsSec: beats, trackDurSec: 60, targetSec: 200, lazoInicioSec: 9.3, lazoFinSec: 31, fadeOutSec: 0 });
    expect(plan.loopStartSec).toBe(10); // compases de 2 s desde el pulso de inicio (0)
    expect(plan.loopEndSec).toBe(30);
    const sola = planEmpalme({ beatsSec: beats, trackDurSec: 60, targetSec: 200, lazoFinSec: 16.9 });
    expect(sola.loopEndSec).toBe(16);
  });

  it('--corte-en pone un empalme en el compás de salida más cercano', () => {
    const beats = grilla(120, 0, 60);
    const base = planEmpalme({ beatsSec: beats, trackDurSec: 60, targetSec: 50, fadeOutSec: 0 });
    expect(base.splices.map((s) => s.outSec)).toEqual([]);
    const largo = planEmpalme({ beatsSec: beats, trackDurSec: 20, targetSec: 50, fadeOutSec: 0, cortesEnSec: [27.3, 40.9] });
    const salidas = largo.splices.map((s) => s.outSec);
    // 27,3 está más cerca del compás en 28; 40,9 del compás en 40 (compases de 2 s).
    expect(salidas).toContain(28);
    expect(salidas).toContain(40);
    for (const t of salidas) expect(t % 2).toBeCloseTo(0, 6);
    // Sigue cubriendo la duración pedida.
    expect(largo.segments.reduce((a, s) => a + s.lenSec, 0)).toBeCloseTo(50, 6);
  });

  it('la entrada gradual es de 0,3 s si el inicio no es el comienzo del archivo y se puede ajustar', () => {
    const beats = grilla(120, 0, 60);
    expect(planEmpalme({ beatsSec: beats, trackDurSec: 60, targetSec: 10 }).fadeIn.durSec).toBe(0);
    expect(planEmpalme({ beatsSec: beats, trackDurSec: 60, targetSec: 10, startSec: 20 }).fadeIn.durSec).toBe(0.3);
    expect(planEmpalme({ beatsSec: beats, trackDurSec: 60, targetSec: 10, startSec: 20, fadeInSec: 0.05 }).fadeIn.durSec).toBe(0.05);
    const x = aEstereo(new Float32Array(60 * SR_P).fill(0.5));
    const plan = planEmpalme({ beatsSec: beats, trackDurSec: 60, targetSec: 5, startSec: 20, fadeOutSec: 0 });
    const y = renderizarPlan(x, plan, SR_P, 5 * SR_P);
    expect(y[0]).toBe(0);
    expect(y[2 * Math.round(0.15 * SR_P)]).toBeGreaterThan(0.3);
    expect(y[2 * Math.round(0.5 * SR_P)]).toBeCloseTo(0.5, 5);
  });

  it('--final real termina con el final de la pista (la cola va al último) y no con una caída artificial', () => {
    const p = pistaConCola(44, 6);
    const cuerpo = detectarCuerpo(p.mono, SR_P);
    const target = 100;
    const real = planEmpalme({ beatsSec: p.beats, trackDurSec: p.dur, targetSec: target, cuerpo, final: 'real' });
    const fade = planEmpalme({ beatsSec: p.beats, trackDurSec: p.dur, targetSec: target, cuerpo });
    expect(real.final).toBe('real');
    expect(real.fadeOut.durSec).toBe(0);
    expect(fade.fadeOut.durSec).toBe(2);
    const ult = real.segments[real.segments.length - 1];
    // El último tramo llega hasta el final de la pista y sobra menos de un compás (2 s) de silencio.
    expect(ult.srcStart + ult.lenSec).toBeCloseTo(p.dur, 3);
    expect(real.silencioFinalSec).toBeGreaterThanOrEqual(0);
    expect(real.silencioFinalSec).toBeLessThan(2 + 1e-6);
    // Todos los empalmes siguen sobre pulsos de salida y la cola no se repite.
    for (const sp of real.splices) expect(real.outBeatsSec.some((b) => Math.abs(b - sp.outSec) < 1e-6)).toBe(true);
    const y = monoDe(renderizarPlan(p.estereo, real, SR_P, target * SR_P));
    // Cerca del final del video se oye la caída propia de la pista (muy por debajo del cuerpo)...
    const rms = (a: number, b: number) => 10 * Math.log10(y.slice(a * SR_P, b * SR_P).reduce((s, v) => s + v * v, 0) / ((b - a) * SR_P) + 1e-12);
    expect(rms(target - real.silencioFinalSec - 1.5, target - real.silencioFinalSec - 0.5)).toBeLessThan(rms(30, 31) - 6);
    // ...y no queda silencio de más.
    expect(real.avisos).toEqual([]);
  });

  it('--final real avisa si el largo no cae cerca de un compás de la cola', () => {
    // Lazo de 2 s (un compás): el sobrante siempre es menor que un compás; con compases largos sobra más.
    const beats = grilla(30, 0, 40); // 30 BPM: compás de 8 s
    const plan = planEmpalme({ beatsSec: beats, trackDurSec: 40, targetSec: 100, final: 'real' });
    expect(plan.silencioFinalSec).toBeLessThan(8 + 1e-6);
  });
});

describe('headroom (D5: nada de recortes al escribir)', () => {
  it('aplicarHeadroom baja con una ganancia fija solo si el pico pasa de 0,98', () => {
    const x = Float32Array.from([0.5, -1.5, 0.75]);
    const db = aplicarHeadroom(x);
    expect(db).toBeCloseTo(20 * Math.log10(0.98 / 1.5), 1);
    expect(Math.max(...Array.from(x, Math.abs))).toBeCloseTo(0.98, 5);
    expect(x[0] / x[2]).toBeCloseTo(0.5 / 0.75, 5);
    const y = Float32Array.from([0.5, -0.9]);
    expect(aplicarHeadroom(y)).toBe(0);
    expect(Array.from(y)).toEqual([0.5, Math.fround(-0.9)]);
  });
});

describe('chequearConfianza', () => {
  it('rechaza confianza 0, avisa por debajo de 0,3 y deja pasar lo forzado a mano', () => {
    expect(chequearConfianza({ confidence: 0, manual: false, bpm: 59.7 }).error).toMatch(/--bpm/);
    expect(chequearConfianza({ confidence: 0.1, manual: false, bpm: 100 }).aviso).toMatch(/confianza baja/);
    expect(chequearConfianza({ confidence: 0.5, manual: false, bpm: 100 })).toEqual({});
    expect(chequearConfianza({ confidence: 0, manual: true, bpm: 100 })).toEqual({});
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

describe.skipIf(!HAY_FFMPEG)('empalmar (e2e con ffmpeg)', () => {
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

  it('una fuente con crestas por encima de 0 dBFS sale sin recortar (24 bits y headroom)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      const sr = 48000;
      const entrada = join(dir, 'caliente.wav');
      const salida = join(dir, 'salida.wav');
      // Seno de 440 Hz con amplitud 1,5 en un wav de 32 bits flotante: pasa de 0 dBFS.
      const x = new Float32Array(sr * 6 * 2);
      for (let i = 0; i < x.length / 2; i++) x[2 * i] = x[2 * i + 1] = 1.5 * Math.sin((2 * Math.PI * 440 * i) / sr);
      await codificar(x, { sr, canales: 2, salida: entrada, bits: 32 });
      const r = await empalmar({ entrada, salida, fps: 30, frames: 90, beatsSec: grilla(120, 0, 6), fadeOutSec: 0, fadeInSec: 0 });
      expect(r.headroomDb).toBeLessThan(0);
      const y2 = await decodificar(salida, { sr, canales: 2 });
      const y = monoDe(y2);
      let pico = 0;
      let e = 0;
      for (const v of y) {
        pico = Math.max(pico, Math.abs(v));
        e += v * v;
      }
      expect(pico).toBeLessThan(0.99);
      // Un seno no recortado tiene RMS/pico = 0,707 (recortado en 1,0 sería mucho mayor).
      expect(Math.sqrt(e / y.length) / pico).toBeGreaterThan(0.69);
      expect(Math.sqrt(e / y.length) / pico).toBeLessThan(0.72);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
