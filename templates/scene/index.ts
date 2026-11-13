// Registra la escena como un video propio para poder verla y renderizarla sola:
//   npx ve-sheet <id> --count 12   |   npm run render -- <id>
// Se copia con: bash templates/nuevo.sh escena <slug> <nombre> (corrige imports e id).
// Después agregá el import de esta carpeta a engine/runtime/videos.ts (ver SKILL.md).
import { defineVideo } from "../../engine";
import { DURACION, SceneVideo } from "./Scene";

export default defineVideo({
  id: "plantilla-escena",
  component: SceneVideo,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: DURACION,
  defaultProps: { title: "Título de la escena", subtitle: "Una línea que lo explica" },
});
