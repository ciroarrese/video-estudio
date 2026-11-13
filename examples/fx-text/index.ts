import { defineVideo } from "../../engine";
import { FxText, SEG, SEGMENTS } from "./FxText";

export default defineVideo({
  id: "fx-text",
  component: FxText,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: SEG * SEGMENTS.length,
  defaultProps: { theme: "neutral" },
});
