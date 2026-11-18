// @vitest-environment node
// `cargarVideo` por el camino de `render --list-scenes` (bundle + Chromium): un video del repo con cues por escena y audio propio.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { cargarVideo, cuesAbsolutos, tramosPropios } from './escenas';

const hayPlaywright = (() => {
  try {
    createRequire(import.meta.url)('playwright');
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hayPlaywright)('cargarVideo (audio-check)', () => {
  it('trae las escenas con sus cues relativos y el audio propio; los cues absolutos suman el from de cada escena', async () => {
    const v = await cargarVideo('audio-check', {});
    expect(v.fps).toBe(30);
    expect(v.scenes.map((s) => s.id)).toEqual(['intro', 'cuerpo', 'cierre']);
    expect(cuesAbsolutos(v.scenes, v.durationInFrames).cues.map((c) => [c.sfx, c.frame])).toEqual([['golpe', 0], ['clic', 12], ['clic', 34], ['tilde', 44]]);
    expect(tramosPropios(v.scenes, v.fps).map((t) => [t.escena, t.desdeFrame])).toEqual([['cierre', 60]]);
  }, 120_000);
});
