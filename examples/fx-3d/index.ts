import { defineVideo } from "../../engine";
import { Fx3dGallery, TOTAL_FRAMES } from "./Gallery";

export default defineVideo({
  id: "fx-3d",
  component: Fx3dGallery,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: TOTAL_FRAMES,
  defaultProps: { theme: "neutral" },
});
