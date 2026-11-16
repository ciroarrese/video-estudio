// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodificar, escribirWav16, hayFfmpeg } from './ffmpeg';
import { rmsDb } from './medidas';

const nivel = (x: Float32Array, desde: number, hasta: number) => rmsDb(x, Math.round(desde * 48000) * 2, Math.round((hasta - desde) * 48000) * 2);
import { mezclar } from './mezcla';
import { aEstereo, pistaDeClics, pistaDeVoz } from './pistas-de-prueba';
import { colocarVoz, ventanasDeVoz, verificarVozEscenas } from './voz';

const SR = 48000;

describe('ventanasDeVoz', () => {
  it('encuentra las frases de una pista sintética', () => {
    const x = pistaDeVoz({ seconds: 8, sr: SR, frases: [[1, 3], [4.5, 7]] });
    const t = ventanasDeVoz(x, SR);
    expect(t).toHaveLength(2);
    expect(t[0]!.iniSample / SR).toBeCloseTo(1, 1);
    expect(t[0]!.finSample / SR).toBeCloseTo(3, 1);
    expect(t[1]!.iniSample / SR).toBeCloseTo(4.5, 1);
    expect(t[1]!.finSample / SR).toBeCloseTo(7, 1);
  });
  it('une las pausas cortas (entre palabras) y no las largas (entre frases)', () => {
    const x = pistaDeVoz({ seconds: 6, sr: SR, frases: [[0.5, 1.5], [1.7, 2.7], [4, 5]] });
    const t = ventanasDeVoz(x, SR, { uneMs: 350 });
    expect(t).toHaveLength(2); // la pausa de 0,2 s se une; la de 1,3 s no
    expect(ventanasDeVoz(x, SR, { uneMs: 50 })).toHaveLength(3);
  });
  it('descarta un clic cortísimo y no inventa voz en el silencio', () => {
    const x = new Float32Array(SR * 2);
    for (let i = 0; i < 100; i++) x[SR + i] = 0.5;
    expect(ventanasDeVoz(x, SR)).toHaveLength(0);
    expect(ventanasDeVoz(new Float32Array(SR), SR)).toEqual([]);
  });
  it('el umbral se adapta al nivel de la grabación (una voz baja también se detecta)', () => {
    const x = pistaDeVoz({ seconds: 4, sr: SR, frases: [[1, 2.5]], amplitud: 0.02 });
    const t = ventanasDeVoz(x, SR);
    expect(t).toHaveLength(1);
  });
});

describe('colocarVoz', () => {
  it('la ubica en el video, aplica la ganancia y recorta lo que pasa', () => {
    const crudo = aEstereo(pistaDeVoz({ seconds: 3, sr: SR, frases: [[0, 3]] }));
    const n = SR * 4;
    const r = colocarVoz(crudo, SR, n, { archivo: 'x', enSec: 2, gain: 0.5 });
    // antes de 2 s, silencio; después, voz a media ganancia; el último 1 s de voz no entra (el video termina a 4 s)
    expect(r.estereo.subarray(0, 2 * SR * 2 - 10).every((v) => v === 0)).toBe(true);
    expect(r.avisos.some((a) => /dura más que el video/.test(a))).toBe(true);
    expect(r.ventanas).toHaveLength(1);
    expect(r.ventanas[0]!.iniSample / SR).toBeCloseTo(2, 1);
    expect(r.ventanas[0]!.profundidadDb).toBe(8);
    expect(colocarVoz(crudo, SR, n, { archivo: 'x', duckDb: 0 }).ventanas.every((v) => v.profundidadDb === 0)).toBe(true);
  });
  it('avisa si la voz está en silencio, es muy baja o recorta', () => {
    expect(colocarVoz(new Float32Array(SR * 2), SR, SR, { archivo: 'x' }).avisos.join()).toMatch(/silencio/);
    expect(colocarVoz(aEstereo(pistaDeVoz({ seconds: 1, sr: SR, frases: [[0, 1]], amplitud: 0.01 })), SR, SR, { archivo: 'x' }).avisos.join()).toMatch(/muy baja/);
    const fuerte = aEstereo(new Float32Array(SR).fill(1));
    expect(colocarVoz(fuerte, SR, SR, { archivo: 'x' }).avisos.join()).toMatch(/recortada/);
  });
  it('rechaza valores inválidos', () => {
    expect(() => colocarVoz(new Float32Array(10), SR, 10, { archivo: 'x', gain: -1 })).toThrow(/gain/);
    expect(() => colocarVoz(new Float32Array(10), SR, 10, { archivo: 'x', enSec: -1 })).toThrow(/negativ/);
  });
});

describe('verificarVozEscenas', () => {
  const t = (desde: number, hasta: number, texto = 'frase') => ({ desde, hasta, texto });
  it('una frase que cruza un corte', () => {
    const a = verificarVozEscenas([t(2, 6, 'una frase larga que cruza')], [5]);
    expect(a).toHaveLength(1);
    expect(a[0]!.tipo).toBe('cruza-corte');
    expect(a[0]!.mensaje).toMatch(/cruza el corte de escena de 5.00 s/);
  });
  it('roza el corte si se pasa o arranca por poco', () => {
    expect(verificarVozEscenas([t(2, 5.1)], [5]).map((x) => x.tipo)).toEqual(['roza-corte']);
    expect(verificarVozEscenas([t(4.9, 7)], [5]).map((x) => x.tipo)).toEqual(['roza-corte']);
  });
  it('sin avisos si cada frase queda de un solo lado', () => {
    expect(verificarVozEscenas([t(0.5, 4.8), t(5.3, 9)], [5], { duracionSec: 10 })).toEqual([]);
  });
  it('solapados y fuera del video', () => {
    const a = verificarVozEscenas([t(0, 3), t(2.5, 4), t(9, 12)], [], { duracionSec: 10 });
    expect(a.map((x) => x.tipo).sort()).toEqual(['fuera-del-video', 'solapado'].sort());
  });
  it('lectura rápida de un subtítulo', () => {
    const a = verificarVozEscenas([t(0, 1, 'un texto que no se alcanza a leer en un segundo')], []);
    expect(a.map((x) => x.tipo)).toEqual(['lectura-rapida']);
    expect(verificarVozEscenas([t(0, 1, 'un texto que no se alcanza a leer en un segundo')], [], { maxCps: 0 })).toEqual([]);
  });
});

describe.skipIf(!hayFfmpeg())('mezcla con voz', () => {
  let dir = '';
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 've-voz-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const FPS = 30;
  const FRAMES = 240; // 8 s

  it('solo voz: sale un archivo de la duración del video con la voz en su lugar', async () => {
    const voz = join(dir, 'voz.wav');
    escribirWav16(voz, pistaDeVoz({ seconds: 3, sr: SR, frases: [[0, 3]] }), SR, 1);
    const salida = join(dir, 'solo-voz.wav');
    const r = await mezclar({ fps: FPS, durationFrames: FRAMES, cues: [], voz: { archivo: voz, enSec: 2 }, salida });
    const y = await decodificar(salida, { sr: SR, canales: 2 });
    expect(y.length / 2 / SR).toBeCloseTo(8, 1);
    expect(r.info.tramosVozSec).toHaveLength(1);
    expect(r.info.tramosVozSec[0]!.desde).toBeCloseTo(2, 1);
    expect(r.info.tramosVozSec[0]!.hasta).toBeCloseTo(5, 1);
    expect(nivel(y, 2.2, 4.5)).toBeGreaterThan(nivel(y, 0, 1.9) + 60); // antes de entrar, silencio
    expect(nivel(y, 5.2, 8)).toBeLessThan(nivel(y, 2.2, 4.5) - 60); // y después de terminar
  });

  it('la música baja mientras habla la voz y vuelve después (ducking por voz)', async () => {
    const musica = join(dir, 'musica.wav');
    escribirWav16(musica, pistaDeClics({ bpm: 120, seconds: 8, sr: SR, padSec: 0.1, amplitud: 0 }), SR, 1); // colchón constante (pad), sin clics
    const voz = join(dir, 'voz2.wav');
    escribirWav16(voz, pistaDeVoz({ seconds: 3, sr: SR, frases: [[0, 3]] }), SR, 1);
    const base = { fps: FPS, durationFrames: FRAMES, cues: [], musica: { archivo: musica, gain: 1, fadeOutSec: 0 } };
    const leer = async (n: string) => decodificar(join(dir, n), { sr: SR, canales: 2 });
    await mezclar({ ...base, salida: join(dir, 'A.wav') }); // música sola
    const r = await mezclar({ ...base, voz: { archivo: voz, enSec: 2, duckDb: 10 }, salida: join(dir, 'B.wav') }); // con ducking
    await mezclar({ fps: FPS, durationFrames: FRAMES, cues: [], voz: { archivo: voz, enSec: 2 }, salida: join(dir, 'V.wav') }); // voz sola
    const [A, B, V] = [await leer('A.wav'), await leer('B.wav'), await leer('V.wav')];
    // música con ducking = mezcla B menos la voz sola (mismas muestras de voz: nada la limita ni la normaliza)
    const bajada = new Float32Array(B.length);
    for (let i = 0; i < B.length; i++) bajada[i] = B[i]! - V[i]!;
    expect(nivel(bajada, 2.5, 4.5) - nivel(A, 2.5, 4.5)).toBeCloseTo(-10, 0); // durante la voz, 10 dB abajo
    expect(Math.abs(nivel(bajada, 0.3, 1.5) - nivel(A, 0.3, 1.5))).toBeLessThan(0.3); // antes, igual
    expect(Math.abs(nivel(bajada, 6.5, 7.5) - nivel(A, 6.5, 7.5))).toBeLessThan(0.3); // después de la subida, igual
    expect(r.info.ventanasVoz).toHaveLength(1);
    expect(r.info.ventanasVoz[0]!.profundidadDb).toBe(10);
    // con --voz-duck-db 0 la música no se toca
    await mezclar({ ...base, voz: { archivo: voz, enSec: 2, duckDb: 0 }, salida: join(dir, 'C.wav') });
    const C = await leer('C.wav');
    const sinBajar = new Float32Array(C.length);
    for (let i = 0; i < C.length; i++) sinBajar[i] = C[i]! - V[i]!;
    expect(Math.abs(nivel(sinBajar, 2.5, 4.5) - nivel(A, 2.5, 4.5))).toBeLessThan(0.3);
  });

  it('cuenta con el --lufs y el techo de pico como el resto de la mezcla', async () => {
    const voz = join(dir, 'voz3.wav');
    escribirWav16(voz, pistaDeVoz({ seconds: 4, sr: SR, frases: [[0, 4]] }), SR, 1);
    const r = await mezclar({ fps: FPS, durationFrames: FRAMES, cues: [], voz: { archivo: voz }, lufs: -16, techoDbtp: -1.5, salida: join(dir, 'lufs.wav') });
    expect(r.info.lufsFinal).not.toBeNull();
    expect(Math.abs(r.info.lufsFinal! + 16)).toBeLessThan(1);
    expect(r.info.picoVerdaderoDbtp).toBeLessThanOrEqual(-1.4);
  });

  it('un archivo de voz inexistente falla antes de procesar', async () => {
    await expect(mezclar({ fps: FPS, durationFrames: 30, cues: [], voz: { archivo: join(dir, 'no-existe.wav') }, salida: join(dir, 'x.wav') })).rejects.toThrow(/archivo de voz/);
  });
});
