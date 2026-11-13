import { defineVideo } from '../../engine';
import { Hello } from './Hello';

export default defineVideo({
  id: 'hello',
  component: Hello,
  fps: 30,
  width: 1280,
  height: 720,
  durationInFrames: 90,
  // 1280x720 es el base; vertical (720x1280) y cuadrado (720x720) se derivan solos.
  formats: ['vertical', 'cuadrado'],
});
