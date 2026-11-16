import { defineVideo } from "../../engine";
import { SubtitulosDemo } from "./SubtitulosDemo";

// ~10 s con subtítulos de primera clase: bloque o karaoke, en los tres formatos. Los textos y tiempos están en `subtitulos.json`.
export default defineVideo({
  id: "subtitulos-demo",
  component: SubtitulosDemo,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 300,
  formats: ["vertical", "cuadrado"],
  defaultProps: { theme: "neutral", estilo: "karaoke" },
});
