// Ayudas para pruebas que necesitan videos propios sin tocar el `videos/` real del proyecto.
//
// `withTempVideos` es lo que hay que usar: crea una carpeta temporal (en `out/`, fuera de git y del hash del
// proyecto) que hace de `videos/` mediante VE_VIDEOS_DIR; `ensureBundle` y vite.config.ts la usan en lugar de `videos/`
// (que ni se compila ni entra en el hash). Así la prueba no depende de los videos en construcción de la persona, ni los
// contamina con carpetas temporales, ni necesita cerrojo: cada prueba tiene su propia carpeta y su propio bundle.
//
// `withVideosDir` (cerrojo sobre el `videos/` real) queda solo para pruebas que de verdad necesitan escribir ahí; el cerrojo
// guarda el pid y se rompe solo si quedó de una corrida muerta (ver `lockIsStale`).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ruta absoluta de `engine/` (los videos temporales viven fuera de `videos/` y importan el motor con ruta absoluta). */
export const engineDir = join(raiz, 'engine');

/** Corre `fn` con `VE_VIDEOS_DIR` apuntando a una carpeta temporal vacía; la borra y restaura el entorno al terminar. */
export async function withTempVideos<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const parent = join(raiz, 'out'); // no oculta: el glob de vite ignora carpetas con punto; 'out' no entra al hash del proyecto
  mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(join(parent, 'tmp-videos-'));
  const saved = process.env.VE_VIDEOS_DIR;
  process.env.VE_VIDEOS_DIR = dir;
  try {
    return await fn(dir);
  } finally {
    if (saved === undefined) delete process.env.VE_VIDEOS_DIR;
    else process.env.VE_VIDEOS_DIR = saved;
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Escribe archivos (ruta relativa -> contenido) bajo `dir`, creando las carpetas. Para armar videos temporales dentro de `withTempVideos`. */
export function writeVideoFiles(dir: string, files: Record<string, string | Uint8Array>): void {
  for (const [rel, content] of Object.entries(files)) {
    const f = join(dir, rel);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, content);
  }
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/** Un cerrojo está vencido si su dueño (pid) ya no existe, o si es más viejo que `maxAgeMs` (por si el pid se reutilizó). */
export function lockIsStale(lock: string, maxAgeMs = 15 * 60_000): boolean {
  try {
    const pid = Number(readFileSync(join(lock, 'pid'), 'utf8'));
    if (Number.isInteger(pid) && pid > 0 && !alive(pid)) return true;
  } catch {
    /* sin archivo de pid: se decide por la antigüedad */
  }
  try {
    return Date.now() - statSync(lock).mtimeMs > maxAgeMs;
  } catch {
    return false; // desapareció: el que reintenta lo resuelve
  }
}

export async function withVideosDir<T>(root: string, fn: () => Promise<T> | T, o: { maxAgeMs?: number; waitMs?: number } = {}): Promise<T> {
  const lockParent = join(root, '.ve-cache');
  const lock = join(lockParent, 'videos.lock');
  mkdirSync(lockParent, { recursive: true });
  const deadline = Date.now() + (o.waitMs ?? 600_000);
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, 'pid'), String(process.pid));
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      if (lockIsStale(lock, o.maxAgeMs)) {
        rmSync(lock, { recursive: true, force: true }); // quedó de una corrida muerta
        continue;
      }
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
