import { defineVideo } from '../../engine';
import { Hello } from './Hello';

export default defineVideo({
  id: 'hello',
  component: Hello,
  fps: 30,
  width: 1280,
  height: 720,
  durationInFrames: 90,
});
