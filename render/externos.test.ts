// @vitest-environment node
// Videos fuera del repo (VE_VIDEOS_DIR con ruta absoluta bajo el directorio temporal del sistema).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { engineDir } from './testing';

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

const video = (id: string, from: string) => `import React from "react";
import { defineVideo, useFrame } from ${JSON.stringify(from)};
const V = () => React.createElement("div", null, "cuadro " + useFrame());
export default defineVideo({ id: "${id}", component: V, fps: 30, width: 320, height: 180, durationInFrames: 4 });
`;

describe.skipIf(!hasPlaywright || !hasFfmpeg)('VE_VIDEOS_DIR fuera del repo', () => {
  it('descubre los videos (y los ejemplos) y resuelve el motor por alias y por ruta absoluta', async () => {
    const { discoverVideos } = await import('./index');
    const dir = mkdtempSync(join(tmpdir(), 've-externo-'));
    const cache = mkdtempSync(join(tmpdir(), 've-externo-cache-'));
    const saved = process.env.VE_VIDEOS_DIR;
    try {
      for (const [slug, id, from] of [['con-alias', 'ext-alias', 'video-estudio/engine'], ['con-ruta', 'ext-ruta', engineDir]] as const) {
        mkdirSync(join(dir, slug), { recursive: true });
        writeFileSync(join(dir, slug, 'index.ts'), video(id, from));
      }
      mkdirSync(join(dir, '.oculta'), { recursive: true });
      writeFileSync(join(dir, '.oculta', 'index.ts'), video('no-debe-estar', 'video-estudio/engine'));
      process.env.VE_VIDEOS_DIR = dir;
      const { videos, errors } = await discoverVideos({ cacheDir: cache });
      const ids = videos.map((v) => v.id);
      expect(errors).toEqual([]);
      expect(ids).toContain('hello');
      expect(ids).toContain('ext-alias');
      expect(ids).toContain('ext-ruta');
      expect(ids).not.toContain('no-debe-estar');
      expect(videos.find((v) => v.id === 'ext-alias')!.source).toBe('videos/con-alias');
    } finally {
      if (saved === undefined) delete process.env.VE_VIDEOS_DIR;
      else process.env.VE_VIDEOS_DIR = saved;
      rmSync(dir, { recursive: true, force: true });
      rmSync(cache, { recursive: true, force: true });
    }
  }, 120_000);

  it('una carpeta que no existe falla con un mensaje claro en vez de listar vacío', async () => {
    const { discoverVideos } = await import('./index');
    const saved = process.env.VE_VIDEOS_DIR;
    process.env.VE_VIDEOS_DIR = join(tmpdir(), 've-no-existe-' + process.pid);
    try {
      await expect(discoverVideos({ cacheDir: mkdtempSync(join(tmpdir(), 've-externo-cache-')) })).rejects.toThrow(/VE_VIDEOS_DIR apunta a .* no existe/);
    } finally {
      if (saved === undefined) delete process.env.VE_VIDEOS_DIR;
      else process.env.VE_VIDEOS_DIR = saved;
    }
  });
});
