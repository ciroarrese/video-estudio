import { defineVideo } from "../../engine";
import { AnnotationDemo } from "./AnnotationDemo";

export default defineVideo({
  id: "annotation-demo",
  component: AnnotationDemo,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  // `theme`: neutral | dark | editorial | neon | papel. `variant`: fuerza otra señal (excepción explícita); sin ella manda el design system.
  defaultProps: { theme: "neutral" },
});
