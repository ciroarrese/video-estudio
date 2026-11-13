import type { FormatName } from './format';

export type VideoConfig = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  /** Formato en el que se dibuja (lo completa el runtime; si falta se deduce de `width` y `height`). */
  format?: FormatName;
};
