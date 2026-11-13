// @vitest-environment node
// La huella por video (ve-deps.json) sigue imports dinámicos, import.meta.glob y new URL(literal, import.meta.url) fuera de la
// carpeta del video; si no puede seguir algo (new URL(variable, ...), import(variable)) lo marca opaco (huella = todo el bundle).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileHashCache } from './filehash';
import { ensureBundle, newRunId, videoCodeHash } from './render';
import { engineDir, withTempVideos } from './testing';

const raiz = resolve(__dirname, '..');
const w = (dir: string, f: string, t: string) => {
  mkdirSync(join(dir, f, '..'), { recursive: true });
  writeFileSync(join(dir, f), t);
};
const def = (id: string, extra = '') => `import { defineVideo } from ${JSON.stringify(engineDir)};
${extra}
export default defineVideo({ id: "${id}", component: () => null, fps: 30, width: 320, height: 180, durationInFrames: 3 });
`;

describe('ve-deps.json: clausura por video', () => {
  it('incluye imports dinámicos, glob y recursos con new URL fuera de la carpeta; marca lo opaco', async () => {
    const out = mkdtempSync(join(tmpdir(), 've-deps-'));
    try {
      await withTempVideos(async (dir) => {
        w(dir, 'a/index.ts', def('va', `const lazy = () => import('./lazy');
const logo = new URL('../compartido/logo.txt', import.meta.url).href;
const todos = import.meta.glob('../compartido/*.ts');
export { lazy, logo, todos };`));
        w(dir, 'a/lazy.ts', 'export const x = 1;\n');
        w(dir, 'compartido/logo.txt', 'logo');
        w(dir, 'compartido/util.ts', 'export const u = 1;\n');
        w(dir, 'b/index.ts', def('vb', `const f = (n: string) => new URL('./' + n + '.png', import.meta.url).href;\nexport { f };`));
        w(dir, 'c/index.ts', def('vc'));
        const bundle = await ensureBundle(raiz, out, newRunId(), () => {});
        const deps = JSON.parse(readFileSync(join(bundle, 've-deps.json'), 'utf8')) as { videos: Record<string, string[]>; opaque: string[] };
        expect(deps.videos['videos/a']).toEqual(expect.arrayContaining(['videos/a/index.ts', 'videos/a/lazy.ts', 'videos/compartido/logo.txt', 'videos/compartido/util.ts']));
        expect(deps.opaque).toEqual(['videos/b']);
        expect(deps.videos['videos/c']).not.toContain('videos/a/lazy.ts');
        expect(deps.opaque).not.toContain('videos/c');

        // la huella de `a` cambia al tocar el recurso de afuera o el módulo cargado en diferido; la de `c`, no
        const h = (s: string) => videoCodeHash(raiz, bundle, s, { videosDir: dir });
        const [a0, c0] = [await h('videos/a'), await h('videos/c')];
        expect(a0).not.toBeNull();
        w(dir, 'compartido/logo.txt', 'otro logo');
        const a1 = await h('videos/a');
        expect(a1).not.toBe(a0);
        w(dir, 'a/lazy.ts', 'export const x = 2;\n');
        expect(await h('videos/a')).not.toBe(a1);
        expect(await h('videos/c')).toBe(c0);
        // un video opaco no tiene huella propia: se usa la del bundle entero
        expect(await h('videos/b')).toBeNull();
      });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 300_000);
});

describe('FileHashCache', () => {
  it('hashea por contenido y solo relee lo que cambió (tamaño, mtime o ctime)', async () => {
    const d = mkdtempSync(join(tmpdir(), 've-fh-'));
    try {
      const f = join(d, 'x.bin');
      writeFileSync(f, 'uno');
      const cache = new FileHashCache(join(d, 'cache.json'));
      const h1 = await cache.hashOf(f);
      await cache.hashOf(f);
      expect(cache.reads).toBe(1);
      cache.save();
      const otra = new FileHashCache(join(d, 'cache.json')); // otro proceso: lee la cache del disco
      expect(await otra.hashOf(f)).toBe(h1);
      expect(otra.reads).toBe(0);
      writeFileSync(f, 'dos'); // mismo tamaño, otro contenido
      expect(await otra.hashOf(f)).not.toBe(h1);
      expect(otra.reads).toBe(1);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});
