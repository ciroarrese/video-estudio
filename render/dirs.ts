// Dónde se escriben la cache de compilación y las salidas por defecto.
//
// Sin VE_VIDEOS_DIR: `.ve-cache/` (en el clon) y `out/` (relativo a donde se corre el comando).
// Con VE_VIDEOS_DIR (videos privados en una carpeta de afuera): `<VE_VIDEOS_DIR>/.ve-cache/` y `<VE_VIDEOS_DIR>/out/`.
// La cache guarda el bundle compilado (fuentes, logos y código de las escenas), segmentos y cuadros: nada de eso puede quedar
// dentro del clon público, que alguien podría comprimir o compartir. Se pueden forzar con VE_CACHE_DIR y VE_OUT_DIR.
import { existsSync, rmSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

/** Carpeta que hace de `videos/` (VE_VIDEOS_DIR) o `null` si se usa la del repo. */
export const videosDirExterna = (): string | null => (process.env.VE_VIDEOS_DIR ? resolve(process.env.VE_VIDEOS_DIR) : null);

/** Línea de `--list` cuando los videos están afuera: las carpetas se muestran como `videos/<slug>` pero viven en `ext`. `null` si no hay carpeta externa. */
export const notaCarpetaExterna = (ext: string | null): string | null =>
  ext ? `Videos fuera del repo (VE_VIDEOS_DIR): las carpetas \`videos/<slug>\` de esta lista son \`${ext}/<slug>\`.\n` : null;

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

/**
 * Ruta absoluta de un archivo de salida que la persona pasó con `--out` (o `--json`).
 *  - Absoluta: tal cual.
 *  - Sin `VE_VIDEOS_DIR` ni `VE_OUT_DIR`: relativa al directorio actual (`cwd`), como siempre.
 *  - Con alguna de las dos (salidas fuera del clon): si empieza con `out/` (o es `out`), ese `out` es la carpeta de salidas
 *    (`VE_OUT_DIR`, o `<VE_VIDEOS_DIR>/out`), así `out/x.mp4` cae en `<VE_VIDEOS_DIR>/out/x.mp4`; cualquier otra relativa
 *    cuelga de `VE_VIDEOS_DIR` (o, si solo hay `VE_OUT_DIR`, de esa carpeta). Nunca queda dentro del clon por ser relativa.
 */
export function resolverSalida(ruta: string, cwd: string = process.cwd(), env: NodeJS.ProcessEnv = process.env): string {
  if (isAbsolute(ruta)) return ruta;
  const videos = env.VE_VIDEOS_DIR ? resolve(cwd, env.VE_VIDEOS_DIR) : null;
  const outDir = env.VE_OUT_DIR ? resolve(cwd, env.VE_OUT_DIR) : null;
  if (!videos && !outDir) return resolve(cwd, ruta);
  const r = ruta.replace(/^(?:\.[\\/])+/, '');
  const m = /^out(?:[\\/]+(.*))?$/.exec(r);
  if (m) return join(outDir ?? join(videos!, 'out'), m[1] ?? '');
  return join(videos ?? outDir!, r);
}

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
