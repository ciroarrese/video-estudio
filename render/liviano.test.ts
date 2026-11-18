// @vitest-environment node
// `--liviano [MB]`: tasa de video según duración y tope, y la copia real con ffmpeg (el tamaño queda bajo el tope, el audio se copia).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCliArgs } from './args';
import { copiaLiviana, salidaLiviana, tasaDeVideo } from './liviano';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;

describe('--liviano: argumentos', () => {
  it('sin valor vale 25; con valor numérico (separado o con =) lo toma; no se come el id', () => {
    expect(parseCliArgs(['hello']).liviano).toBeUndefined();
    expect(parseCliArgs(['hello', '--liviano']).liviano).toBe(25);
    expect(parseCliArgs(['--liviano', 'hello']).liviano).toBe(25);
    expect(parseCliArgs(['hello', '--liviano', '12.5']).liviano).toBe(12.5);
    expect(parseCliArgs(['hello', '--liviano=30', '--crf', '20']).liviano).toBe(30);
    expect(parseCliArgs(['hello', '--liviano', '--crf', '20']).liviano).toBe(25);
    expect(parseCliArgs(['hello', '--liviano', '20']).videoId).toBe('hello');
    expect(() => parseCliArgs(['hello', '--liviano=0'])).toThrow(/--liviano/);
    expect(() => parseCliArgs(['hello', '--liviano=abc'])).toThrow(/--liviano/);
  });
});

describe('--liviano: cálculo', () => {
  it('la salida es <salida>-liviano.mp4', () => {
    expect(salidaLiviana('/x/out/a.mp4')).toBe('/x/out/a-liviano.mp4');
    expect(salidaLiviana('/x/out/a-vertical.mp4')).toBe('/x/out/a-vertical-liviano.mp4');
  });
  it('la tasa de video deja lugar al audio y al margen; null si no alcanza', () => {
    const tope = 25 * 1048576;
    const bps = tasaDeVideo({ duracion: 600, topeBytes: tope, audioBps: 192_000 })!;
    // el video + el audio entran en el tope, con margen
    expect(((bps + 192_000) * 600) / 8).toBeLessThan(tope * 0.951);
    expect(((bps + 192_000) * 600) / 8).toBeGreaterThan(tope * 0.9);
    expect(tasaDeVideo({ duracion: 600, topeBytes: 1_000_000, audioBps: 192_000 })).toBeNull(); // el audio solo ya pesa más
  });
});

describe.skipIf(!hasFfmpeg)('--liviano: copia real', () => {
  it('baja de tamaño por debajo del tope, copia el audio y conserva la duración; si ya entra, copia idéntica', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-liviano-'));
    try {
      const origen = join(dir, 'a.mp4');
      // 3 s de video con ruido (pesa bastante) y un tono
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=480x270:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
        '-vf', 'noise=alls=25:allf=t', '-t', '3', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', origen]);
      const tam = statSync(origen).size;
      expect(tam).toBeGreaterThan(300_000);
      const mb = Math.floor(((tam * 0.4) / 1048576) * 100) / 100;
      const logs: string[] = [];
      const r = await copiaLiviana(origen, mb, (m) => logs.push(m));
      expect(r.out).toBe(join(dir, 'a-liviano.mp4'));
      expect(r.bytes).toBe(statSync(r.out).size);
      expect(r.bytes).toBeLessThanOrEqual(mb * 1048576);
      expect(r.ok).toBe(true);
      const sonda = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name', '-of', 'json', r.out], { encoding: 'utf8' }));
      expect(Number(sonda.format.duration)).toBeGreaterThan(2.8);
      expect(sonda.streams.map((s: { codec_name: string }) => s.codec_name).sort()).toEqual(['aac', 'h264']);
      // un tope que el original ya cumple: copia sin recodificar
      const r2 = await copiaLiviana(origen, 100, undefined, join(dir, 'b-liviano.mp4'));
      expect(r2.bytes).toBe(tam);
      // un tope que no alcanza ni para el audio
      await expect(copiaLiviana(origen, 0.01)).rejects.toThrow(/no alcanzan/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
