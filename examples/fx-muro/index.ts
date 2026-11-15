import { defineVideo } from "../../engine";
import { FxMuro, DURATION } from "./FxMuro";

export default defineVideo({
  id: "fx-muro",
  component: FxMuro,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: DURATION,
  // `theme`: neutral | dark | editorial | neon | papel. `density`: auto (por defecto) o off (el tamaño de diseño de cada efecto, para comparar).
  defaultProps: { theme: "neutral", density: "auto" },
});
