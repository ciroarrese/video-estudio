// Descubrimiento automático de videos: toda carpeta `examples/<id>/index.ts(x)` y `videos/<slug>/index.ts(x)`
// (también `videos/<slug>/<carpeta>/index.ts(x)`, que es donde `templates/nuevo.sh` deja las escenas y la historia)
// se carga acá y se registra con su `defineVideo`. No hace falta editar este archivo para agregar un video.
// Si `videos/` no existe (está fuera del repo), el patrón simplemente no encuentra nada.
// Con la variable de entorno VE_VIDEOS_DIR, vite.config.ts reemplaza `../../videos/` por esa carpeta (pruebas con videos temporales).
import { loadVideos, type LoadError } from './discover';

declare const __VE_VIDEOS_EXT__: string; // lo define vite.config.ts: prefijo relativo de VE_VIDEOS_DIR ('' si no se usa)

const modules = import.meta.glob([
  '../../examples/*/index.{ts,tsx}',
  '../../videos/*/index.{ts,tsx}',
  '../../videos/*/*/index.{ts,tsx}',
]);

/** Se resuelve cuando todas las carpetas se intentaron cargar; trae un error por carpeta que falló (nunca rechaza). */
export const videosReady: Promise<LoadError[]> = loadVideos(modules, __VE_VIDEOS_EXT__);
