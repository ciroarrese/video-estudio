import { defineVideo } from "../../engine";
import { FxInScene, DURATION } from "./FxInScene";

export default defineVideo({
  id: "fx-in-scene",
  component: FxInScene,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: DURATION,
  defaultProps: { theme: "neutral" },
});
