// Ayuda para pruebas que crean carpetas temporales en `videos/`: las serializa con un cerrojo (un directorio atómico) para que dos
// archivos de prueba en paralelo no se pisen, y deja `videos/` como estaba (si no existía antes de todas, tampoco queda).
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withVideosDir<T>(root: string, fn: () => Promise<T> | T): Promise<T> {
  const lockParent = join(root, '.ve-cache');
  const lock = join(lockParent, 'videos.lock');
  mkdirSync(lockParent, { recursive: true });
  const deadline = Date.now() + 600_000;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      if (Date.now() > deadline) throw new Error('withVideosDir: el cerrojo de videos/ no se liberó');
      await sleep(250);
    }
  }
  const videos = join(root, 'videos');
  const existed = existsSync(videos);
  try {
    return await fn();
  } finally {
    if (!existed && existsSync(videos) && readdirSync(videos).length === 0) rmSync(videos, { recursive: true, force: true });
    rmSync(lock, { recursive: true, force: true });
  }
}
