// Registra la escena como un video propio para poder verla y renderizarla sola:
//   npx ve-sheet <id> --count 12   |   npm run render -- <id>
// Se copia con: bash templates/nuevo.sh escena <slug> <nombre> (corrige imports e id).
// No hace falta registrarla: el runtime descubre toda carpeta videos/<slug>/**/index.ts (npm run render -- --list).
import { defineVideo } from "../../engine";
import { DURACION, SceneVideo } from "./Scene";

export default defineVideo({
  id: "plantilla-escena",
  component: SceneVideo,
  fps: 30,
  width: 1920,
  height: 1080,
  // El formato base (1920x1080) siempre existe. Cada formato extra exige diseñar su disposición en Scene.tsx
  // (`useFormat().pick`); agregá "cuadrado" solo cuando la tengas. Se mira con --format vertical.
  formats: ["vertical"],
  durationInFrames: DURACION,
  defaultProps: { title: "Título de la escena", subtitle: "Una línea que lo explica" },
});
