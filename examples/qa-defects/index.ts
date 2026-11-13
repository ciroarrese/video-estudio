import { defineVideo } from '../../engine';
import { QaDefects } from './QaDefects';

export default defineVideo({
  id: 'qa-defects',
  component: QaDefects,
  fps: 30,
  width: 1280,
  height: 720,
  durationInFrames: 12,
});
