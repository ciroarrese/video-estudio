// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SceneInfo } from '../engine';
import { cuesAbsolutos, tramosPropios, unirTramos } from './escenas';

/** Escenas de un video armadas con una tabla de duraciones: cada una declara sus cues en cuadros RELATIVOS. */
function escenas(dur: { intro: number; cuerpo: number }): SceneInfo[] {
  return [
    { id: 'intro', from: 0, durationInFrames: dur.intro, cues: [{ frame: 0, sfx: 'golpe' }, { frame: 12, sfx: 'clic' }] },
    { id: 'cuerpo', from: dur.intro, durationInFrames: dur.cuerpo, cues: [{ frame: 4, sfx: 'clic', gain: 0.5 }, { frame: 14, sfx: 'tilde', ancla: 'pico' }] },
    { id: 'cierre', from: dur.intro + dur.cuerpo, durationInFrames: 30, audioPropio: { desde: 5 } },
  ];
}

describe('cuesAbsolutos', () => {
  it('suma el comienzo de cada escena a sus cues relativos y conserva gain y ancla', () => {
    const r = cuesAbsolutos(escenas({ intro: 30, cuerpo: 40 }), 100);
    expect(r.cues).toEqual([
      { frame: 0, sfx: 'golpe' }, { frame: 12, sfx: 'clic' }, { frame: 34, sfx: 'clic', gain: 0.5 }, { frame: 44, sfx: 'tilde', ancla: 'pico' },
    ]);
    expect(r.escenaDeCue).toEqual(['intro', 'intro', 'cuerpo', 'cuerpo']);
    expect(r.avisos).toEqual([]);
  });
  it('al alargar una escena todos los cues siguientes se corren lo mismo, y los de ella no se mueven', () => {
    const a = cuesAbsolutos(escenas({ intro: 30, cuerpo: 40 })).cues;
    const b = cuesAbsolutos(escenas({ intro: 45, cuerpo: 40 })).cues;
    expect(b.map((c, i) => c.frame - a[i]!.frame)).toEqual([0, 0, 15, 15]);
  });
  it('avisa un cue que cae fuera de su escena o del video, y rechaza uno inválido', () => {
    const r = cuesAbsolutos([{ id: 'x', from: 10, durationInFrames: 20, cues: [{ frame: 25, sfx: 'clic' }] }], 30);
    expect(r.avisos[0]).toMatch(/dura 20 cuadros/);
    expect(cuesAbsolutos([{ id: 'x', from: 10, durationInFrames: 40, cues: [{ frame: 25, sfx: 'clic' }] }], 30).avisos[0]).toMatch(/fuera del video/);
    expect(() => cuesAbsolutos([{ id: 'x', from: 0, durationInFrames: 5, cues: [{ frame: -1, sfx: 'clic' }] }])).toThrow(/frame inválido/);
  });
});

describe('tramosPropios', () => {
  it('true es toda la escena; un objeto es un tramo relativo; sin declarar no hay tramo', () => {
    const s: SceneInfo[] = [
      { id: 'a', from: 0, durationInFrames: 30 },
      { id: 'b', from: 30, durationInFrames: 60, audioPropio: true },
      { id: 'c', from: 90, durationInFrames: 60, audioPropio: { desde: 10, hasta: 40 } },
      { id: 'd', from: 150, durationInFrames: 30, audioPropio: false },
    ];
    const t = tramosPropios(s, 30);
    expect(t.map((x) => [x.escena, x.desdeFrame, x.hastaFrame])).toEqual([['b', 30, 90], ['c', 100, 130]]);
    expect(t[0]!.desdeSec).toBe(1);
  });
  it('sigue a la escena cuando cambia la duración de la anterior', () => {
    expect(tramosPropios(escenas({ intro: 30, cuerpo: 40 }), 30)[0]!.desdeFrame).toBe(75);
    expect(tramosPropios(escenas({ intro: 30, cuerpo: 60 }), 30)[0]!.desdeFrame).toBe(95);
  });
  it('unirTramos junta los que se tocan', () => {
    const t = tramosPropios([{ id: 'a', from: 0, durationInFrames: 30, audioPropio: true }, { id: 'b', from: 30, durationInFrames: 30, audioPropio: true }, { id: 'c', from: 90, durationInFrames: 30, audioPropio: true }], 30);
    expect(unirTramos(t)).toEqual([{ desdeSec: 0, hastaSec: 2, escenas: ['a', 'b'] }, { desdeSec: 3, hastaSec: 4, escenas: ['c'] }]);
  });
});
