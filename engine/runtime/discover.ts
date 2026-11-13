import { VideoRegistryError, setVideoSource } from '../defineVideo';

export type Loader = () => Promise<unknown>;

/** `../../videos/foo/index.ts` -> `videos/foo`; `../../videos/foo/escena/index.tsx` -> `videos/foo/escena`. */
export function folderOf(path: string): string {
  return path.replace(/^(\.\.?\/)+/, '').replace(/\/index\.[tj]sx?$/, '');
}

/**
 * Carga, de a una y en orden alfabético, las carpetas de video que encontró `import.meta.glob`. Mientras carga cada una
 * avisa al registro de qué carpeta viene, así un `id` repetido se informa con las dos carpetas. Un error al cargar
 * una carpeta (sintaxis, import roto) se informa con su nombre.
 */
export async function loadVideos(modules: Record<string, Loader>): Promise<void> {
  for (const path of Object.keys(modules).sort()) {
    const folder = folderOf(path);
    setVideoSource(folder);
    try {
      await modules[path]!();
    } catch (e) {
      if (e instanceof VideoRegistryError) throw e;
      throw new Error(`No se pudo cargar el video de "${folder}": ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setVideoSource(null);
    }
  }
}
