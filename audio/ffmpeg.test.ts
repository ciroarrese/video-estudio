// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { codificar, decodificar, escribirAtomico, escribirWav16, hayFfmpeg } from './ffmpeg';
import { pistaDeClics } from './pistas-de-prueba';

const HAY_FFMPEG = hayFfmpeg();
if (!HAY_FFMPEG) console.warn('[audio] ffmpeg no está en el PATH: se omiten las pruebas de punta a punta de ffmpeg y la CLI.');

describe('escribirAtomico', () => {
  it('renombra al terminar bien y borra lo parcial si falla', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      const destino = join(dir, 'sub', 'a.wav');
      await escribirAtomico(destino, async (tmp) => {
        expect(tmp).not.toBe(destino);
        writeFileSync(tmp, 'x');
      });
      expect(readdirSync(join(dir, 'sub'))).toEqual(['a.wav']);
      await expect(
        escribirAtomico(destino, async (tmp) => {
          writeFileSync(tmp, 'parcial');
          throw new Error('falló');
        }),
      ).rejects.toThrow('falló');
      // La salida anterior sigue intacta y no queda el temporal.
      expect(readdirSync(join(dir, 'sub'))).toEqual(['a.wav']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!HAY_FFMPEG)('ffmpeg y CLI (e2e)', () => {
  it('codificar con un formato inválido no deja archivos', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      await expect(codificar(new Float32Array(2000), { sr: 8000, canales: 2, salida: join(dir, 'x.formato-inexistente') })).rejects.toThrow();
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('acepta rutas relativas que empiezan con "-" (entrada y salida)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      const sr = 48000;
      escribirWav16(join(dir, '-pista.wav'), pistaDeClics({ bpm: 120, seconds: 6, sr, padSec: 1 }), sr, 1);
      const tsx = resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');
      const cli = resolve(__dirname, 'cli.ts');
      const r = spawnSync(tsx, [cli, 'empalme', '-pista.wav', '--out', '-salida.wav', '--segundos', '4', '--bpm', '120', '--offset', '1'], { cwd: dir, encoding: 'utf8' });
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
      expect(existsSync(join(dir, '-salida.wav'))).toBe(true);
      const y = await decodificar(join(dir, '-salida.wav'), { sr, canales: 1 });
      expect(Math.abs(y.length / sr - 4)).toBeLessThan(0.05);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('la CLI rechaza --inicio inválido y una pista en silencio sin --bpm', () => {
    const dir = mkdtempSync(join(tmpdir(), 've-audio-'));
    try {
      const sr = 48000;
      escribirWav16(join(dir, 'silencio.wav'), new Float32Array(sr * 6), sr, 1);
      escribirWav16(join(dir, 'clics.wav'), pistaDeClics({ bpm: 120, seconds: 6, sr }), sr, 1);
      const tsx = resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');
      const cli = resolve(__dirname, 'cli.ts');
      const corre = (...a: string[]) => spawnSync(tsx, [cli, ...a], { cwd: dir, encoding: 'utf8' });
      const a = corre('empalme', 'clics.wav', '--out', 'o.wav', '--segundos', '3', '--inicio', 'foo');
      expect(a.status).toBe(1);
      expect(a.stderr).toMatch(/--inicio tiene que ser un número/);
      const b = corre('empalme', 'clics.wav', '--out', 'o.wav', '--segundos', '3', '--inicio');
      expect(b.status).toBe(1);
      expect(b.stderr).toMatch(/--inicio necesita un valor/);
      const c = corre('empalme', 'silencio.wav', '--out', 'o.wav', '--segundos', '3');
      expect(c.status).toBe(1);
      expect(c.stderr).toMatch(/--bpm y --offset/);
      expect(existsSync(join(dir, 'o.wav'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});

