// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { engineDir, withTempVideos } from './testing';

const raiz = resolve(__dirname, '..');
const has = (cmd: string, args: string[]) => {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const hasPlaywright = (() => {
  try {
    createRequire(import.meta.url)('playwright');
    return true;
  } catch {
    return false;
  }
})();
const ready = hasPlaywright && has('ffmpeg', ['-version']);

const videoMinimo = (id: string) => `import React from "react";
import { defineVideo, useFrame } from ${JSON.stringify(engineDir)};
const V = () => React.createElement("div", { style: { fontSize: 40 } }, "cuadro " + useFrame());
export default defineVideo({ id: "${id}", component: V, fps: 30, width: 320, height: 180, durationInFrames: 6, formats: ["vertical"] });
`;

describe('registro automático de videos (sin tocar engine/runtime/videos.ts)', () => {
  // El id repetido entre dos carpetas se prueba sin tocar videos/ en engine/runtime/discover.test.ts (con carpetas simuladas),
  // para que un video repetido de prueba no contamine el bundle de otras pruebas que corren en paralelo.
  it('videos.ts no necesita imports a mano', () => {
    const src = readFileSync(join(raiz, 'engine/runtime/videos.ts'), 'utf8');
    expect(src).not.toMatch(/^import ['"]\.\.\/\.\.\//m);
    expect(src).toContain('import.meta.glob');
    expect(src).toContain('videos/*/index');
  });

  it.skipIf(!ready)('lista, renderiza y el hash de bundle incluye el video (en una carpeta temporal, sin tocar videos/)', async () => {
    const { listVideos, renderVideo, ensureBundle, newRunId } = await import('./index');
    await withTempVideos(async (dir) => {
      const carpeta = join(dir, 'tmp-test-registro');
      const out = mkdtempSync(join(tmpdir(), 've-registro-'));
      try {
        mkdirSync(carpeta, { recursive: true });
        writeFileSync(join(carpeta, 'index.ts'), videoMinimo('tmp-test-registro'));
        const lista = await listVideos();
        const v = lista.find((m) => m.id === 'tmp-test-registro');
        expect(v).toMatchObject({ width: 320, height: 180, source: 'videos/tmp-test-registro' });
        expect(Object.keys(v!.formats!)).toEqual(['horizontal', 'vertical']);
        expect(lista.some((m) => m.id === 'hello')).toBe(true); // los ejemplos siguen estando

        const r = await renderVideo({ videoId: 'tmp-test-registro', format: 'vertical', frames: [0, 1], out: join(out, 'a.mp4'), cacheDir: join(out, 'cache'), concurrency: 1, audio: false });
        expect(r.frames).toBe(2);
        const dim = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', join(out, 'a.mp4')]).toString().trim();
        expect(dim).toBe('180,320');

        // el hash del bundle incluye videos/: agregar un archivo cambia el bundle
        const cache = join(out, 'cache2');
        const b1 = await ensureBundle(raiz, cache, newRunId(), () => {}); // la clave del directorio sale de los fuentes (incluido videos/)
        writeFileSync(join(carpeta, 'extra.ts'), 'export const x = 1;\n');
        const b2 = await ensureBundle(raiz, cache, newRunId(), () => {});
        expect(b2).not.toBe(b1);
        rmSync(join(carpeta, 'extra.ts'));
      } finally {
        rmSync(carpeta, { recursive: true, force: true });
        rmSync(out, { recursive: true, force: true });
      }
    });
    expect(existsSync(join(raiz, 'videos', 'tmp-test-registro'))).toBe(false); // nunca se escribe en el videos/ real
  }, 400_000);
});
