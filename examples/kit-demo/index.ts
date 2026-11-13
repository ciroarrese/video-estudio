import { defineVideo } from "../../engine";
import { KitDemo } from "./KitDemo";

export default defineVideo({
  id: "kit-demo",
  component: KitDemo,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 300,
  defaultProps: { theme: "neutral" },
});
