// Cues y audio propio por escena en el motor: `<Sequence cues audioPropio>`, `defineVideo({ scenes })` y `defineStory` (TopicScene.cues / audioPropio).
// Vive en audio/ porque prueba la interfaz que consume `npm run audio -- mezcla|informe|empalme --video`.
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { FrameProvider, Sequence, clearScenes, collectScenes, defineVideo } from '../engine';
import { defineStory } from '../stories';
import type { StorySpec, TopicScene } from '../stories';
import { cuesAbsolutos, tramosPropios } from './escenas';

describe('<Sequence name cues audioPropio>', () => {
  beforeEach(() => clearScenes());
  it('registra los cues (relativos) y el audio propio junto con la escena; sin ellos el registro queda como antes', () => {
    render(
      <FrameProvider frame={50} config={{ fps: 30, width: 10, height: 10, durationInFrames: 100 }}>
        <Sequence from={40} durationInFrames={30} name="cuerpo" cues={[{ frame: 4, sfx: 'clic' }]} audioPropio={{ desde: 10 }}><i /></Sequence>
        <Sequence from={0} durationInFrames={90} name="todo"><i /></Sequence>
      </FrameProvider>,
    );
    const s = collectScenes();
    expect(s.find((x) => x.id === 'cuerpo')).toEqual({ id: 'cuerpo', from: 40, durationInFrames: 30, cues: [{ frame: 4, sfx: 'clic' }], audioPropio: { desde: 10 } });
    expect(s.find((x) => x.id === 'todo')).toEqual({ id: 'todo', from: 0, durationInFrames: 90 });
  });
});

describe('defineVideo({ scenes })', () => {
  const base = { component: () => null, fps: 30, width: 320, height: 180, durationInFrames: 90 };
  it('guarda los cues y valida su frame', () => {
    const v = defineVideo({ ...base, id: 'prueba-cues', scenes: [{ id: 'a', from: 0, durationInFrames: 30, cues: [{ frame: 3, sfx: 'clic' }], audioPropio: true }] });
    expect(v.scenes![0]!.cues).toEqual([{ frame: 3, sfx: 'clic' }]);
    expect(() => defineVideo({ ...base, id: 'prueba-cues-mal', scenes: [{ id: 'a', from: 0, durationInFrames: 30, cues: [{ frame: -2, sfx: 'clic' }] }] })).toThrow(/cue/);
  });
});

describe('defineStory', () => {
  const spec: StorySpec = {
    title: { text: 'Título', highlight: 'Título' },
    topics: [{ id: 'a', name: 'Primero', line: 'uno' }, { id: 'b', name: 'Segundo', line: 'dos' }],
    labels: ['Uno', 'Dos'],
    signoff: { text: 'Chau', tagline: 'Nota' },
  };
  const escena = (id: string, dur: number, extra: Partial<TopicScene> = {}): TopicScene => ({ id, component: () => null, durationInFrames: dur, ...extra });
  const cuesDe = (durA: number) =>
    defineStory({ id: `story-cues-${durA}`, spec, fitCheck: false, scenes: [escena('a', durA, { cues: [{ frame: 5, sfx: 'golpe' }] }), escena('b', 90, { cues: [{ frame: 20, sfx: 'tilde' }], audioPropio: { desde: 60 } })] });

  it('las escenas de tema exportan cues y audio propio, y la historia los junta con el desplazamiento de cada escena', () => {
    const v = cuesDe(90);
    const a = v.scenes!.find((s) => s.id === 'a')!;
    const b = v.scenes!.find((s) => s.id === 'b')!;
    expect(a.cues).toEqual([{ frame: 5, sfx: 'golpe' }]);
    expect(v.scenes!.find((s) => s.id === 'opening')!.cues).toBeUndefined();
    const abs = cuesAbsolutos(v.scenes!, v.durationInFrames).cues;
    expect(abs.map((c) => c.frame)).toEqual([a.from + 5, b.from + 20]);
    expect(tramosPropios(v.scenes!, v.fps)[0]).toMatchObject({ escena: 'b', desdeFrame: b.from + 60, hastaFrame: b.from + 90 });
  });
  it('al cambiar la duración de una escena los cues de las siguientes se corren lo mismo sin tocar nada a mano', () => {
    const corto = cuesAbsolutos(cuesDe(90).scenes!).cues;
    const largo = cuesAbsolutos(cuesDe(120).scenes!).cues;
    expect(largo[0]!.frame - corto[0]!.frame).toBe(0);
    expect(largo[1]!.frame - corto[1]!.frame).toBe(30);
  });
});
