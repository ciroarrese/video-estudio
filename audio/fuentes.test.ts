// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { leerPistas, leerTramosPropios, parsear } from './args';
import { empalmar } from './empalme';
import { runFfmpeg, escribirWav16, hayFfmpeg, sondear } from './ffmpeg';
import { aWavSiMp3, destinoDeConversion } from './fuentes';
import { pistaDeClics } from './pistas-de-prueba';

describe('destinoDeConversion', () => {
  it('en una carpeta audio/ cae en audio/fuentes; fuera, en una carpeta temporal estable', () => {
    expect(destinoDeConversion('/v/videos/demo/audio/tema.mp3')).toBe(join('/v/videos/demo/audio', 'fuentes', 'tema.wav'));
    const a = destinoDeConversion('/musica/tema.mp3', '/tmp', 10, 5);
    expect(a).toBe(destinoDeConversion('/musica/tema.mp3', '/tmp', 10, 5));
    expect(a).not.toBe(destinoDeConversion('/musica/tema.mp3', '/tmp', 11, 5));
    expect(a.startsWith(join('/tmp', 've-audio-fuentes'))).toBe(true);
  });
});

describe('args nuevos', () => {
  const op = (...a: string[]) => parsear(a).op;
  it('--pista', () => {
    expect(leerPistas(op('--pista', 'cierre=a/b.wav@12.5,otra=c.wav'))).toEqual([{ nombre: 'cierre', archivo: 'a/b.wav', enSec: 12.5 }, { nombre: 'otra', archivo: 'c.wav' }]);
    expect(() => leerPistas(op('--pista', 'voz=a.wav'))).toThrow(/reservado/);
    expect(() => leerPistas(op('--pista', 'x=a.wav,x=b.wav'))).toThrow(/más de una vez/);
    expect(leerPistas(op())).toBeUndefined();
  });
  it('--audio-propio', () => {
    expect(leerTramosPropios(op('--audio-propio', '12.5-15,f300-f450'), 30)).toEqual([{ desdeSec: 12.5, hastaSec: 15 }, { desdeSec: 10, hastaSec: 15 }]);
    expect(() => leerTramosPropios(op('--audio-propio', '5-3'), 30)).toThrow(/mayor/);
    expect(() => leerTramosPropios(op('--audio-propio', '5'), 30)).toThrow(/desde-hasta/);
  });
});

describe.skipIf(!hayFfmpeg())('mp3 a wav al entrar', () => {
  let dir = '';
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 've-fuentes-'));
    mkdirSync(join(dir, 'audio'));
    escribirWav16(join(dir, 'x.wav'), pistaDeClics({ bpm: 120, seconds: 3, sr: 48000 }), 48000, 1);
    await runFfmpeg(['-y', '-i', join(dir, 'x.wav'), join(dir, 'audio', 'tema.mp3')]);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('convierte una vez a audio/fuentes/<nombre>.wav, lo reusa y deja el mismo archivo', async () => {
    const mp3 = join(dir, 'audio', 'tema.mp3');
    const a = await aWavSiMp3(mp3);
    expect(a).toMatchObject({ eraMp3: true, convertido: true });
    expect(resolve(a.ruta)).toBe(join(dir, 'audio', 'fuentes', 'tema.wav'));
    expect(sondear(a.ruta)!.codec).toMatch(/^pcm/);
    const bytes = readFileSync(a.ruta);
    const m = statSync(a.ruta).mtimeMs;
    const b = await aWavSiMp3(mp3);
    expect(b).toMatchObject({ convertido: false, eraMp3: true, ruta: a.ruta });
    expect(statSync(b.ruta).mtimeMs).toBe(m);
    rmSync(a.ruta);
    expect((await aWavSiMp3(mp3)).convertido).toBe(true);
    expect(readFileSync(a.ruta).equals(bytes)).toBe(true); // determinista
  });
  it('un wav o un archivo que no existe pasan tal cual', async () => {
    expect(await aWavSiMp3(join(dir, 'x.wav'))).toEqual({ ruta: join(dir, 'x.wav'), convertido: false, eraMp3: false });
    expect((await aWavSiMp3(join(dir, 'no-esta.mp3'))).eraMp3).toBe(false);
    expect(existsSync(join(dir, 'audio', 'fuentes'))).toBe(true);
  });
});

describe.skipIf(!hayFfmpeg())('empalme informa las pausas propias de la pista', () => {
  it('silenciosInternos trae el hueco del medio de la fuente y no la intro ni la cola', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-pausas-'));
    try {
      const sr = 48000;
      const x = pistaDeClics({ bpm: 120, seconds: 16, sr, padSec: 4 });
      x.fill(0, 9 * sr, 11.2 * sr); // pausa de la pista entre 9 y 11,2 s
      const entrada = join(dir, 'p.wav');
      escribirWav16(entrada, x, sr, 1);
      const beats = Array.from({ length: 24 }, (_, k) => 4 + k * 0.5);
      const r = await empalmar({ entrada, salida: join(dir, 'o.wav'), fps: 30, frames: 300, beatsSec: beats, startSec: 4, fadeOutSec: 1 });
      expect(r.silenciosInternos).toHaveLength(1);
      expect(r.silenciosInternos[0]!.desde).toBeGreaterThan(8.5);
      expect(r.silenciosInternos[0]!.hasta).toBeLessThan(11.6);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
