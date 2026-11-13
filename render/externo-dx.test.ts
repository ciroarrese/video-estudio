// @vitest-environment node
// Experiencia de quien tiene los videos en una carpeta fuera del repo: `nuevo.sh` con VE_VIDEOS_DIR genera escena + tsconfig + env.d.ts,
// el typecheck de esa carpeta pasa (incluido un `import f from "...otf?url"`), `--list` la ve y se renderizan 2 cuadros.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tool = (cmd: string) => {
  try {
    execFileSync(cmd, ['-version'], { stdio: 'ignore' });
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
const FUENTE = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].find((f) => existsSync(f));

describe('carpeta de videos externa: nuevo.sh, typecheck, --list y render', () => {
  it('genera una escena con imports por alias, pasa el typecheck, se lista y renderiza 2 cuadros', async () => {
    const dir = mkdtempSync(join(tmpdir(), 've-externo-dx-'));
    const cache = mkdtempSync(join(tmpdir(), 've-externo-dx-cache-'));
    const env = { ...process.env, VE_VIDEOS_DIR: dir };
    try {
      execFileSync('bash', ['templates/nuevo.sh', 'escena', 'demo', 'uno'], { cwd: repo, env, stdio: 'pipe' });
      const tsconfig = readFileSync(join(dir, 'tsconfig.json'), 'utf8');
      expect(tsconfig).not.toContain('__REPO__');
      expect(tsconfig).not.toContain('baseUrl');
      expect(tsconfig).toContain(repo);
      expect(existsSync(join(dir, 'env.d.ts'))).toBe(true);
      const index = readFileSync(join(dir, 'demo', 'uno', 'index.ts'), 'utf8');
      expect(index).toContain('"video-estudio/engine"');
      expect(index).not.toMatch(/"\.\.\/\.\.\/\.\.\/engine"/);
      expect(readFileSync(join(dir, 'demo', 'theme.ts'), 'utf8')).toContain('"video-estudio/themes"');
      // un import de fuente por ?url (lo declara env.d.ts)
      if (FUENTE) {
        mkdirSync(join(dir, 'assets', 'fonts'), { recursive: true });
        copyFileSync(FUENTE, join(dir, 'assets', 'fonts', 'Prueba.ttf'));
        writeFileSync(join(dir, 'demo', 'fuente.ts'), 'import f from "../assets/fonts/Prueba.ttf?url";\nexport const url: string = f;\n');
      }
      // typecheck (el mismo que `npm run typecheck:videos`)
      execFileSync(join(repo, 'node_modules', '.bin', 'tsx'), ['render/typecheck-externo.ts'], { cwd: repo, env, stdio: 'pipe' });
      // una escena con un error de tipos tiene que fallar
      writeFileSync(join(dir, 'demo', 'mal.ts'), 'export const n: number = "no";\n');
      expect(() => execFileSync(join(repo, 'node_modules', '.bin', 'tsx'), ['render/typecheck-externo.ts'], { cwd: repo, env, stdio: 'pipe' })).toThrow();
      rmSync(join(dir, 'demo', 'mal.ts'));

      if (hasPlaywright && tool('ffmpeg')) {
        const { discoverVideos, renderVideo } = await import('./index');
        const saved = process.env.VE_VIDEOS_DIR;
        process.env.VE_VIDEOS_DIR = dir;
        try {
          const { videos, errors } = await discoverVideos({ cacheDir: cache });
          expect(errors).toEqual([]);
          expect(videos.map((v) => v.id)).toContain('demo-uno');
          const r = await renderVideo({ videoId: 'demo-uno', frames: [0, 1], out: join(dir, 'o.mp4'), cacheDir: cache, audio: false });
          expect(r.frames).toBe(2);
          expect(existsSync(join(dir, 'o.mp4'))).toBe(true);
        } finally {
          if (saved === undefined) delete process.env.VE_VIDEOS_DIR;
          else process.env.VE_VIDEOS_DIR = saved;
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(cache, { recursive: true, force: true });
    }
  }, 300_000);
});
