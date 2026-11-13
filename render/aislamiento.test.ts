// @vitest-environment node
// Un video roto o con id repetido no deja inservibles a los demás; las pruebas no dependen del `videos/` real.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { engineDir, lockIsStale, withTempVideos, withVideosDir } from './testing';

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

const video = (id: string) => `import React from "react";
import { defineVideo, useFrame } from ${JSON.stringify(engineDir)};
const V = () => React.createElement("div", null, "cuadro " + useFrame());
export default defineVideo({ id: "${id}", component: V, fps: 30, width: 320, height: 180, durationInFrames: 4 });
`;
const carpeta = (dir: string, nombre: string, src: string) => {
  mkdirSync(join(dir, nombre), { recursive: true });
  writeFileSync(join(dir, nombre, 'index.ts'), src);
};

describe.skipIf(!ready)('carpetas rotas y ids repetidos (VE_VIDEOS_DIR)', () => {
  it('siguen cargando los demás; --list junta los errores; solo falla el video involucrado', async () => {
    const { discoverVideos, renderVideo } = await import('./index');
    await withTempVideos(async (dir) => {
      carpeta(dir, 'bueno', video('bueno'));
      carpeta(dir, 'dup-a', video('repetido'));
      carpeta(dir, 'dup-b', video('repetido'));
      carpeta(dir, 'explota', `throw new Error('falla a propósito');\n`);
      carpeta(dir, 'sintaxis', `export const x = ;\n`);
      carpeta(dir, 'import-roto', `import "./no-existe";\n`);
      carpeta(dir, 'tarde', video('tarde') + `throw new Error('después de registrar');\n`);
      const out = mkdtempSync(join(tmpdir(), 've-aisl-'));
      try {
        const { videos, errors } = await discoverVideos({ cacheDir: join(out, 'cache') });
        const ids = videos.map((v) => v.id);
        expect(ids).toContain('hello'); // los ejemplos
        expect(ids).toContain('bueno');
        expect(ids).toContain('repetido');
        expect(errors.map((e) => e.folder).sort()).toEqual(['videos/dup-b', 'videos/explota', 'videos/import-roto', 'videos/sintaxis', 'videos/tarde']);
        const dup = errors.find((e) => e.folder === 'videos/dup-b')!;
        expect(dup.message).toMatch(/"repetido".*videos\/dup-a.*videos\/dup-b/);
        expect(errors.find((e) => e.folder === 'videos/explota')!.message).toMatch(/videos\/explota.*falla a propósito/);
        expect(errors.find((e) => e.folder === 'videos/sintaxis')!.message).toMatch(/videos\/sintaxis.*index\.ts.*no compila/);
        expect(errors.find((e) => e.folder === 'videos/import-roto')!.message).toMatch(/videos\/import-roto/);

        const base = { cacheDir: join(out, 'cache'), concurrency: 1, audio: false, frames: [0, 1] as [number, number] };
        // un video sano se renderiza aunque haya cinco carpetas rotas
        const r = await renderVideo({ ...base, videoId: 'bueno', out: join(out, 'ok.mp4') });
        expect(r.frames).toBe(2);
        // el id repetido falla y nombra las dos carpetas
        await expect(renderVideo({ ...base, videoId: 'repetido', out: join(out, 'dup.mp4') })).rejects.toThrow(/"repetido".*videos\/dup-a.*videos\/dup-b/);
        // el que alcanzó a registrarse antes de fallar también
        await expect(renderVideo({ ...base, videoId: 'tarde', out: join(out, 't.mp4') })).rejects.toThrow(/después de registrar/);
        // un id que no existe lista los errores (puede ser uno de los que no cargaron)
        await expect(renderVideo({ ...base, videoId: 'no-hay', out: join(out, 'n.mp4') })).rejects.toThrow(/Unknown video "no-hay"[\s\S]*Carpetas con errores[\s\S]*videos\/explota/);
      } finally {
        rmSync(out, { recursive: true, force: true });
      }
    });
  }, 400_000);

  it('el videos/ real no entra al bundle de pruebas (ni al hash) cuando se usa VE_VIDEOS_DIR', async () => {
    const { ensureBundle, newRunId } = await import('./index');
    const out = mkdtempSync(join(tmpdir(), 've-aisl-'));
    try {
      await withTempVideos(async (dir) => {
        carpeta(dir, 'uno', video('uno'));
        const a = await ensureBundle(raiz, join(out, 'c'), newRunId(), () => {});
        // cambiar el videos/ real (no existe una carpeta nueva acá: se simula con el hash) no cambia la clave; cambiar la temporal sí
        writeFileSync(join(dir, 'uno', 'extra.ts'), 'export const x = 1;\n');
        const b = await ensureBundle(raiz, join(out, 'c'), newRunId(), () => {});
        expect(b).not.toBe(a);
      });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 400_000);
});

describe('cerrojo de videos/ vencido', () => {
  it('un cerrojo de un proceso muerto se rompe solo (en vez de esperar 600 s)', async () => {
    const root = mkdtempSync(join(tmpdir(), 've-lock-'));
    try {
      const lock = join(root, '.ve-cache', 'videos.lock');
      mkdirSync(lock, { recursive: true });
      writeFileSync(join(lock, 'pid'), '2147483646'); // no existe
      expect(lockIsStale(lock)).toBe(true);
      const t0 = Date.now();
      const r = await withVideosDir(root, () => 'entró', { waitMs: 5_000 });
      expect(r).toBe('entró');
      expect(Date.now() - t0).toBeLessThan(2_000);
      expect(existsSync(lock)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('un cerrojo sin pid se vence por antigüedad; uno vivo y reciente no', () => {
    const root = mkdtempSync(join(tmpdir(), 've-lock-'));
    try {
      const lock = join(root, 'l');
      mkdirSync(lock);
      expect(lockIsStale(lock, 60_000)).toBe(false);
      const viejo = new Date(Date.now() - 3_600_000);
      utimesSync(lock, viejo, viejo);
      expect(lockIsStale(lock, 60_000)).toBe(true);
      writeFileSync(join(lock, 'pid'), String(process.pid));
      utimesSync(lock, new Date(), new Date());
      expect(lockIsStale(lock, 60_000)).toBe(false); // mi propio pid está vivo
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
