// @vitest-environment node
// Una familia del sistema que el tema nombra sin archivo y no está instalada avisa (o falla con strictFonts) en vez de salir en silencio con la de reserva.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cuadrosAMirar, describirFuentesFaltantes, strictFonts } from './fuentesSistema';
import { renderVideo } from './render';
import { withTempVideos, writeVideoFiles } from './testing';

const hasPlaywright = (() => {
  try {
    createRequire(import.meta.url)('playwright');
    return true;
  } catch {
    return false;
  }
})();
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const hayDejaVu = existsSync('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');

describe('fuentesSistema: partes puras', () => {
  it('cuadrosAMirar: primero, medio y último, sin repetir', () => {
    expect(cuadrosAMirar(1)).toEqual([0]);
    expect(cuadrosAMirar(2)).toEqual([0, 1]);
    expect(cuadrosAMirar(100)).toEqual([0, 49, 99]);
  });
  it('el mensaje nombra la familia y dice cómo arreglarlo; con strict no repite la sugerencia de la bandera', () => {
    const faltan = [{ family: 'Marca Falsa', sample: 'Hola' }];
    const m = describirFuentesFaltantes(faltan, false);
    expect(m).toContain('"Marca Falsa"');
    expect(m).toContain('theme.font.files');
    expect(m).toContain('--strict-fonts');
    expect(describirFuentesFaltantes(faltan, true)).not.toContain('--strict-fonts');
  });
  it('strictFonts: la opción gana a la variable de entorno', () => {
    expect(strictFonts({ strictFonts: true })).toBe(true);
    expect(strictFonts({ strictFonts: false })).toBe(false);
  });
});

const video = (id: string, family: string) => `import React from "react";
import { defineVideo } from "video-estudio/engine";
import { ThemeScope } from "video-estudio/kit";
import { neutral } from "video-estudio/themes";
const tema = { ...neutral, font: { ...neutral.font, family: ${JSON.stringify(family)} } };
const V = () => <ThemeScope theme={tema} paint style={{ width: 320, height: 180 }}><b>Hola mundo</b></ThemeScope>;
export default defineVideo({ id: ${JSON.stringify(id)}, component: V, fps: 30, width: 320, height: 180, durationInFrames: 3 });
`;

describe.skipIf(!hasPlaywright || !hasFfmpeg)('fuentes del sistema que faltan', () => {
  it('una familia no instalada avisa; con strictFonts falla y nombra la familia', async () => {
    await withTempVideos(async (dir) => {
      writeVideoFiles(dir, { 'falta/index.tsx': video('fuente-falta', '"Familia Inexistente Zz", sans-serif') });
      const cacheDir = mkdtempSync(join(tmpdir(), 've-fuentes-sis-'));
      try {
        const avisos: string[] = [];
        const r = await renderVideo({ videoId: 'fuente-falta', out: join(dir, 'a.mp4'), frames: [0, 1], audio: false, cache: false, cacheDir, log: (m) => avisos.push(m) });
        expect(r.frames).toBe(2);
        expect(avisos.some((m) => /aviso:.*Familia Inexistente Zz.*no está instalada/.test(m))).toBe(true);
        await expect(renderVideo({ videoId: 'fuente-falta', out: join(dir, 'b.mp4'), frames: [0, 1], audio: false, cache: false, cacheDir, strictFonts: true })).rejects.toThrow(/Familia Inexistente Zz/);
      } finally {
        rmSync(cacheDir, { recursive: true, force: true });
      }
    });
  }, 300_000);

  it.skipIf(!hayDejaVu)('una familia instalada y las genéricas no dan aviso', async () => {
    await withTempVideos(async (dir) => {
      writeVideoFiles(dir, { 'ok/index.tsx': video('fuente-instalada', '"DejaVu Sans", system-ui, sans-serif') });
      const cacheDir = mkdtempSync(join(tmpdir(), 've-fuentes-sis-'));
      try {
        const avisos: string[] = [];
        await renderVideo({ videoId: 'fuente-instalada', out: join(dir, 'c.mp4'), frames: [0, 1], audio: false, cache: false, cacheDir, strictFonts: true, log: (m) => avisos.push(m) });
        expect(avisos.filter((m) => /no está instalada|no están instaladas/.test(m))).toEqual([]);
      } finally {
        rmSync(cacheDir, { recursive: true, force: true });
      }
    });
  }, 300_000);
});
