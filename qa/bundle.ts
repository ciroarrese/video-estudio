import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Compiled runtime for the QA tools. render/ keeps its own `ensureBundle` private, so this is a thin
 * stand-in (GAP, see qa/README.md): it builds with vite into `.ve-cache/qa-bundles/<hash of path+size+mtime>`.
 */
export async function ensureQaBundle(root = projectRoot, log: (m: string) => void = () => {}): Promise<string> {
  const skipTop = new Set(['node_modules', 'dist', 'out', 'render', 'docs', 'qa']);
  const h = createHash('sha256');
  const walk = (dir: string, depth: number) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name.startsWith('.') || (depth === 0 && skipTop.has(e.name)) || e.name.endsWith('.md')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.isFile()) {
        const s = statSync(p);
        h.update(`${p}\0${s.size}\0${Math.round(s.mtimeMs)}\n`);
      }
    }
  };
  walk(root, 0);
  const key = h.digest('hex').slice(0, 16);
  const cache = join(root, '.ve-cache', 'qa-bundles');
  const dir = join(cache, key);
  if (existsSync(join(dir, 'index.html'))) return dir;
  log('bundle: compilando con vite...');
  mkdirSync(cache, { recursive: true });
  const tmp = join(cache, `.tmp-${process.pid}`);
  try {
    const vite = await import('vite');
    await vite.build({ configFile: join(root, 'vite.config.ts'), logLevel: 'warn', build: { outDir: tmp, emptyOutDir: true } });
    try {
      renameSync(tmp, dir);
    } catch (e) {
      if (!existsSync(join(dir, 'index.html'))) throw e;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return dir;
}
