import { defineVideo } from "../../engine";
import { FxDataUiArt, TOTAL } from "./FxDataUiArt";

export default defineVideo({
  id: "fx-data-ui-art",
  component: FxDataUiArt,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: TOTAL,
  defaultProps: { theme: "neutral" },
});
