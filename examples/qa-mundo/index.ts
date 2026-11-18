import { defineVideo } from '../../engine';
import { QaMundo } from './QaMundo';

export default defineVideo({
  id: 'qa-mundo',
  component: QaMundo,
  fps: 30,
  width: 1280,
  height: 720,
  durationInFrames: 78,
});
