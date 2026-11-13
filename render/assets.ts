// Carpetas de archivos estáticos (fuentes, logos, audio) que se sirven junto al runtime.
//
// Una sola regla para render, qa, sheet, privacy y el servidor de desarrollo (vite.config.ts usa la misma lista):
//   1. `--assets <dir>` (repetible) y la variable `VE_ASSETS` (rutas separadas por `:`; en Windows por `;`).
//   2. Las del propio video: `<carpeta del video>/assets` y `<carpeta del video>/audio` (la primera carpeta bajo
//      `videos/` o `examples/`: `videos/<slug>/assets`, no la subcarpeta de la escena).
//   3. `<VE_VIDEOS_DIR>/assets` cuando los videos están afuera del repo.
//   4. Después, el bundle y `public/`.
// Gana el primero que tenga el archivo. Solo se incluyen las carpetas que existen.
import { readdirSync, statSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';

const isDir = (p: string) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

/** Carpeta que hace de `videos/` (VE_VIDEOS_DIR) o `null` si se usa la del repo. */
export const externalVideosDir = (): string | null => (process.env.VE_VIDEOS_DIR ? resolve(process.env.VE_VIDEOS_DIR) : null);

/** `--assets` más `VE_ASSETS`, como rutas absolutas (existan o no: el digest de la cache las trata como vacías si faltan). */
export function explicitAssetDirs(assets: string[] = []): string[] {
  const fromEnv = (process.env.VE_ASSETS ?? '').split(delimiter).filter(Boolean);
  return [...new Set([...assets, ...fromEnv].map((a) => resolve(a)))];
}

/**
 * Carpetas `assets` y `audio` que se sirven solas. `source` es la carpeta del video tal como la informa el runtime
 * (`videos/<slug>[/<escena>]` o `examples/<id>`); sin `source` (servidor de desarrollo, que no sabe qué video se mira)
 * entran las de todos los videos.
 */
export function autoAssetDirs(root: string, source?: string | null, videosDir: string | null = externalVideosDir()): string[] {
  const base = (top: 'videos' | 'examples') => (top === 'videos' && videosDir ? videosDir : join(root, top));
  const out: string[] = [];
  const add = (d: string) => {
    if (isDir(d) && !out.includes(d)) out.push(d);
  };
  const m = source ? /^(videos|examples)\/([^/]+)/.exec(source) : null;
  if (m) {
    const dir = join(base(m[1] as 'videos' | 'examples'), m[2]!);
    add(join(dir, 'assets'));
    add(join(dir, 'audio'));
  } else if (!source) {
    for (const top of ['videos', 'examples'] as const) {
      const b = base(top);
      if (!isDir(b)) continue;
      for (const e of readdirSync(b, { withFileTypes: true })) {
        if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
        add(join(b, e.name, 'assets'));
        add(join(b, e.name, 'audio'));
      }
    }
  }
  if (videosDir) add(join(videosDir, 'assets'));
  return out;
}

/** Lista completa de carpetas estáticas en orden de prioridad (sin el bundle ni `public/`, que van al final). */
export const assetDirsFor = (root: string, explicit: string[], source?: string | null): string[] => [...new Set([...explicit.filter(isDir), ...autoAssetDirs(root, source)])];
