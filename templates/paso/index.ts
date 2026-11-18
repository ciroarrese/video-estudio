// Registra el paso como un video propio para poder verlo y renderizarlo solo:
//   npx ve-sheet <id> --count 12   |   npm run render -- <id>
// Se copia con: npm run nuevo -- paso <slug> <nombre> (corrige imports e id).
// No hace falta registrarlo: el runtime descubre toda carpeta videos/<slug>/**/index.ts (npm run render -- --list).
import { defineVideo } from "../../engine";
import { DURACION, PasoVideo } from "./Scene";

export default defineVideo({
  id: "plantilla-paso",
  component: PasoVideo,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: DURACION,
  // Solo horizontal: la disposición de la interfaz de ejemplo (VENTANA, CAMPOS) está escrita para 1920x1080.
  // Para otro formato, diseñá su disposición con `useFormat().pick` y agregalo en `formats`.
  defaultProps: { paso: 1, pasos: 3 },
});
