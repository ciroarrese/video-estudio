import { defineVideo } from "../../engine";
import { DURACION, TutorialDemo } from "./TutorialDemo";

// Tutorial de interfaz de ejemplo: una interfaz ficticia recreada con piezas del kit y dos pasos guiados por `StepFrame`
// (cámara guiada por focos, perfil plano, etiqueta con lado fijo, tarjeta de dato y barra de progreso única).
export default defineVideo({
  id: "tutorial-demo",
  component: TutorialDemo,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: DURACION,
  // `theme`: neutral | dark | editorial | neon | papel.
  defaultProps: { theme: "neutral" },
});
