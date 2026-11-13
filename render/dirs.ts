// Dónde se escriben la cache de compilación y las salidas por defecto.
//
// Sin VE_VIDEOS_DIR: `.ve-cache/` (en el clon) y `out/` (relativo a donde se corre el comando).
// Con VE_VIDEOS_DIR (videos privados en una carpeta de afuera): `<VE_VIDEOS_DIR>/.ve-cache/` y `<VE_VIDEOS_DIR>/out/`.
// La cache guarda el bundle compilado (fuentes, logos y código de las escenas), segmentos y cuadros: nada de eso puede quedar
// dentro del clon público, que alguien podría comprimir o compartir. Se pueden forzar con VE_CACHE_DIR y VE_OUT_DIR.
import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Carpeta que hace de `videos/` (VE_VIDEOS_DIR) o `null` si se usa la del repo. */
export const videosDirExterna = (): string | null => (process.env.VE_VIDEOS_DIR ? resolve(process.env.VE_VIDEOS_DIR) : null);

/** Cache de compilación: `VE_CACHE_DIR`, o `<VE_VIDEOS_DIR>/.ve-cache`, o `<root>/.ve-cache`. */
export function cacheDirPorDefecto(root: string): string {
  if (process.env.VE_CACHE_DIR) return resolve(process.env.VE_CACHE_DIR);
  const ext = videosDirExterna();
  return ext ? join(ext, '.ve-cache') : join(root, '.ve-cache');
}

/** Carpeta de salidas (mp4, hojas): `VE_OUT_DIR`, o `<VE_VIDEOS_DIR>/out`, o `out` relativo al directorio actual. */
export function outDirPorDefecto(): string {
  if (process.env.VE_OUT_DIR) return resolve(process.env.VE_OUT_DIR);
  const ext = videosDirExterna();
  return ext ? join(ext, 'out') : resolve('out');
}

/** Ruta de salida por defecto para un archivo `nombre` dentro de la carpeta de salidas. */
export const salidaPorDefecto = (nombre: string): string => join(outDirPorDefecto(), nombre);

/** Borra cache y salidas: las del clon y, si están definidas, las de la carpeta externa (o las de VE_CACHE_DIR/VE_OUT_DIR). Devuelve lo que borró. */
export function limpiar(root: string, opts: { dryRun?: boolean } = {}): string[] {
  const objetivos = new Set<string>([join(root, '.ve-cache'), join(root, 'out'), cacheDirPorDefecto(root), outDirPorDefecto()]);
  const ext = videosDirExterna();
  if (ext) {
    objetivos.add(join(ext, '.ve-cache'));
    objetivos.add(join(ext, 'out'));
  }
  const borrados: string[] = [];
  for (const d of objetivos) {
    if (!existsSync(d)) continue;
    if (!opts.dryRun) rmSync(d, { recursive: true, force: true });
    borrados.push(d);
  }
  return borrados;
}
