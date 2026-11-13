// Descubrimiento automático de videos: toda carpeta `examples/<id>/index.ts(x)` y `videos/<slug>/index.ts(x)`
// (también `videos/<slug>/<carpeta>/index.ts(x)`, que es donde `templates/nuevo.sh` deja las escenas y la historia)
// se carga acá y se registra con su `defineVideo`. No hace falta editar este archivo para agregar un video.
// Si `videos/` no existe (está fuera del repo), el patrón simplemente no encuentra nada.
import { loadVideos } from './discover';

const modules = import.meta.glob([
  '../../examples/*/index.{ts,tsx}',
  '../../videos/*/index.{ts,tsx}',
  '../../videos/*/*/index.{ts,tsx}',
]);

/** Se resuelve cuando todos los videos quedaron registrados; rechaza con un mensaje claro (id repetido, carpeta rota). */
export const videosReady: Promise<void> = loadVideos(modules);
videosReady.catch(() => {});
