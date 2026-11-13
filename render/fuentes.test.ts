// @vitest-environment node
// Una fuente que no carga tiene que fallar el render (con familia y URL en el mensaje); con --allow-missing-fonts solo avisa.
// Además prueba que `<VE_VIDEOS_DIR>/assets` se sirve solo (sin --assets) y resuelve `asset("fonts/...")`.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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

const SISTEMA = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'].find((f) => existsSync(f));

const videoConFuente = (id: string, src: string) => `import React from "react";
import { defineVideo } from "video-estudio/engine";
import { ThemeScope } from "video-estudio/kit";
import { neutral } from "video-estudio/themes";
import { asset } from "video-estudio/engine";
const tema = { ...neutral, font: { ...neutral.font, family: '"FuenteDePrueba", sans-serif', files: [{ weight: 400, src: ${src} }] } };
const V = () => <ThemeScope theme={tema} paint style={{ width: 320, height: 180 }}><b>Hola</b></ThemeScope>;
export default defineVideo({ id: ${JSON.stringify(id)}, component: V, fps: 30, width: 320, height: 180, durationInFrames: 3 });
`;

describe.skipIf(!hasPlaywright || !hasFfmpeg)('fuentes que no cargan', () => {
  it('un 404 falla el render y nombra familia y URL; con allowMissingFonts solo avisa', async () => {
    await withTempVideos(async (dir) => {
      writeVideoFiles(dir, { 'rota/index.tsx': videoConFuente('fuente-rota', JSON.stringify('/fuentes/no-existe.otf')) });
      const out = join(dir, 'rota.mp4');
      const cacheDir = mkdtempSync(join(tmpdir(), 've-fuentes-cache-'));
      try {
        await expect(renderVideo({ videoId: 'fuente-rota', out, frames: [0, 1], audio: false, cache: false, cacheDir })).rejects.toThrow(/FuenteDePrueba[\s\S]*no-existe\.otf/);
        const avisos: string[] = [];
        const r = await renderVideo({ videoId: 'fuente-rota', out, frames: [0, 1], audio: false, cache: false, cacheDir, allowMissingFonts: true, log: (m) => avisos.push(m) });
        expect(r.frames).toBe(2);
      } finally {
        rmSync(cacheDir, { recursive: true, force: true });
      }
    });
  }, 240_000);

  it.skipIf(!SISTEMA)('una fuente de <VE_VIDEOS_DIR>/assets se sirve sola (sin --assets) y no da falsos positivos', async () => {
    await withTempVideos(async (dir) => {
      mkdirSync(join(dir, 'assets', 'fonts'), { recursive: true });
      copyFileSync(SISTEMA!, join(dir, 'assets', 'fonts', 'prueba.ttf'));
      writeVideoFiles(dir, { 'ok/index.tsx': videoConFuente('fuente-ok', 'asset("fonts/prueba.ttf")') });
      const cacheDir = mkdtempSync(join(tmpdir(), 've-fuentes-cache-'));
      try {
        const r = await renderVideo({ videoId: 'fuente-ok', out: join(dir, 'ok.mp4'), frames: [0, 1], audio: false, cache: false, cacheDir });
        expect(r.frames).toBe(2);
      } finally {
        rmSync(cacheDir, { recursive: true, force: true });
      }
    });
  }, 240_000);
});
