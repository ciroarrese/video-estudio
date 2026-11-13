import { defineVideo } from "../../engine";
import { ThemeScopeDemo } from "./ThemeScopeDemo";

export default defineVideo({
  id: "theme-scope",
  component: ThemeScopeDemo,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 130,
  defaultProps: { theme: "neutral" },
});
