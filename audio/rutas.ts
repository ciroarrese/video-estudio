// Rutas de la línea de comandos de audio, resueltas igual que en el resto de las herramientas (`render/rutas.ts`).
//
// Con los videos afuera del repo (`VE_VIDEOS_DIR=<carpeta>`), `videos/<slug>/x` pasa a `<carpeta>/<slug>/x`: se prueba la ruta tal cual y,
// si no existe, contra esa carpeta. Una ruta absoluta se usa como viene.
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { candidatasDeRuta, resolverRutaVideos } from '../render/rutas';
import { videosDirExterna } from '../render/dirs';

/** Archivo o carpeta que tiene que existir (entrada): ruta absoluta; si no está en ningún lado, el error nombra lo probado. */
export const entrada = (ruta: string, cwd: string = process.cwd(), ext: string | null = videosDirExterna()): string => resolverRutaVideos(ruta, cwd, ext);

/**
 * Archivo (o carpeta) que se escribe y puede no existir todavía: la primera candidata cuya carpeta contenedora ya existe (tal cual y,
 * con VE_VIDEOS_DIR, dentro de esa carpeta); si ninguna, la primera cuya carpeta abuela existe (la carpeta del video, cuando falta `audio/`);
 * si ninguna, la ruta tal cual. Así `--out videos/<slug>/audio/x.wav` cae en la carpeta del video cuando los videos viven afuera del repo.
 */
export function salida(ruta: string, cwd: string = process.cwd(), ext: string | null = videosDirExterna()): string {
  const c = candidatasDeRuta(ruta, cwd, ext);
  return c.find((x) => existsSync(dirname(x))) ?? c.find((x) => existsSync(dirname(dirname(x)))) ?? c[0]!;
}
