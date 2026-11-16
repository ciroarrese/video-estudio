// Resolución de rutas `videos/<slug>/...` cuando los videos viven afuera del repo (VE_VIDEOS_DIR).
//
// Los comandos y la documentación escriben las rutas como `videos/<slug>/prohibidos.txt`; con `VE_VIDEOS_DIR=<carpeta>` esa carpeta hace
// de `videos/`, así que el archivo real es `<carpeta>/<slug>/prohibidos.txt`. Una ruta relativa se prueba primero tal cual (desde el
// directorio actual) y, si no existe y hay VE_VIDEOS_DIR, contra esa carpeta; una absoluta se usa como viene. Si no existe en ningún lado, el error
// nombra todas las rutas probadas.
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { videosDirExterna } from './dirs';

/** Rutas donde se busca `ruta`, en orden: tal cual y, con VE_VIDEOS_DIR, dentro de esa carpeta (sin el prefijo `videos/`). */
export function candidatasDeRuta(ruta: string, cwd: string = process.cwd(), ext: string | null = videosDirExterna()): string[] {
  const r = ruta.trim();
  if (!r) return [];
  const directa = resolve(cwd, r);
  if (isAbsolute(r) || !ext) return [directa];
  const sinPrefijo = r.replace(/^(?:\.[\\/])+/, '').replace(/^videos(?:[\\/]|$)/, '');
  const externa = join(ext, sinPrefijo);
  return directa === externa ? [directa] : [directa, externa];
}

/** Primera candidata que existe, o `null`. */
export function buscarRuta(ruta: string, cwd?: string, ext?: string | null): string | null {
  return candidatasDeRuta(ruta, cwd, ext).find((c) => existsSync(c)) ?? null;
}

/**
 * Ruta absoluta de `ruta` (archivo o carpeta que tiene que existir); si no existe, lanza un error que nombra las rutas probadas
 * y, con VE_VIDEOS_DIR definida, recuerda cómo se traduce `videos/<slug>/...`.
 */
export function resolverRutaVideos(ruta: string, cwd?: string, ext: string | null = videosDirExterna()): string {
  const hallada = buscarRuta(ruta, cwd, ext);
  if (hallada) return hallada;
  const probadas = candidatasDeRuta(ruta, cwd, ext);
  const pista = ext
    ? ` (con VE_VIDEOS_DIR=${ext}, \`videos/<slug>/...\` se busca en \`${ext}/<slug>/...\`; podés pasar la ruta absoluta)`
    : ' (si los videos están en una carpeta de afuera, definí VE_VIDEOS_DIR o pasá la ruta absoluta)';
  throw new Error(`no existe "${ruta}". Busqué en: ${probadas.join(' ; ')}${pista}`);
}

/**
 * Para carpetas que pueden no existir todavía (`--assets`): la primera candidata que existe y, si ninguna, la ruta tal cual
 * (absoluta). Nunca lanza.
 */
export function resolverRutaBlanda(ruta: string, cwd?: string, ext: string | null = videosDirExterna()): string {
  return buscarRuta(ruta, cwd, ext) ?? resolve(cwd ?? process.cwd(), ruta);
}
