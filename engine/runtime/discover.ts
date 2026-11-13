import { VideoRegistryError, getVideos, setVideoSource } from '../defineVideo';

export type Loader = () => Promise<unknown>;

/**
 * Un problema al cargar una carpeta de video. `ids` son los `id` que quedaron comprometidos (un id repetido, o los que la
 * carpeta alcanzó a registrar antes de fallar); `folders` las carpetas involucradas.
 */
export type LoadError = { folder: string; folders: string[]; ids: string[]; message: string };

/** `../../videos/foo/index.ts` -> `videos/foo`; `../../videos/foo/escena/index.tsx` -> `videos/foo/escena`. */
export function folderOf(path: string, externalPrefix = ''): string {
  let p = path;
  // videos en otra carpeta (VE_VIDEOS_DIR): la ruta relativa de vite se muestra como si fuera `videos/`
  if (externalPrefix && p.startsWith(externalPrefix + '/')) p = `videos/${p.slice(externalPrefix.length + 1)}`;
  return p.replace(/^(\.\.?\/)+/, '').replace(/\/index\.[tj]sx?$/, '');
}

/**
 * Carga, de a una y en orden alfabético, las carpetas de video que encontró `import.meta.glob`. Mientras carga cada una
 * avisa al registro de qué carpeta viene, así un `id` repetido se informa con las dos carpetas.
 *
 * NO se corta en el primer error: una carpeta rota (sintaxis, import roto) o un `id` repetido se anotan y se sigue con
 * el resto, así un video en construcción no deja inservibles a los demás. Devuelve los errores (uno por carpeta); quien
 * los consume decide cuándo importan (los del video pedido, o todos si el video pedido no existe).
 */
export async function loadVideos(modules: Record<string, Loader>, externalPrefix = ''): Promise<LoadError[]> {
  const errors: LoadError[] = [];
  for (const path of Object.keys(modules).sort()) {
    const folder = folderOf(path, externalPrefix);
    setVideoSource(folder);
    try {
      await modules[path]!();
    } catch (e) {
      const mine = getVideos().filter((v) => v.source === folder).map((v) => v.id);
      if (e instanceof VideoRegistryError) {
        errors.push({ folder, folders: e.folders.length ? e.folders : [folder], ids: [...new Set([...(e.id ? [e.id] : []), ...mine])], message: e.message });
      } else {
        errors.push({ folder, folders: [folder], ids: mine, message: `No se pudo cargar el video de "${folder}": ${e instanceof Error ? e.message : String(e)}` });
      }
    } finally {
      setVideoSource(null);
    }
  }
  return errors;
}
