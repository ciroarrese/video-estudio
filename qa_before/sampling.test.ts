import { describe, expect, it } from 'vitest';
import { composeStory } from '../stories';
import { sceneRange } from '../render/meta';
import { demoScenes, spec } from '../examples/story-demo/StoryDemo';
import { evenFrames, everyFrames, parseFrameList, sampleFrames } from './sampling';

describe('frame sampling', () => {
  it('parses lists, ranges and steps, deduplicating', () => {
    expect(parseFrameList('0,60,120', 300)).toEqual([0, 60, 120]);
    expect(parseFrameList('10-13', 300)).toEqual([10, 11, 12, 13]);
    expect(parseFrameList('0-90/30,60', 300)).toEqual([0, 30, 60, 90]);
  });
  it('rejects bad specs and out-of-range frames', () => {
    expect(() => parseFrameList('a', 10)).toThrow(/invalidos/);
    expect(() => parseFrameList('5-2', 10)).toThrow(/Rango/);
    expect(() => parseFrameList('10', 10)).toThrow(RangeError);
    expect(() => parseFrameList('', 10)).toThrow();
  });
  it('spreads count frames evenly, first and last included', () => {
    expect(evenFrames(300, 4)).toEqual([0, 100, 199, 299]);
    expect(evenFrames(300, 1)).toEqual([0]);
    expect(evenFrames(5, 24)).toEqual([0, 1, 2, 3, 4]);
    expect(() => evenFrames(10, 0)).toThrow();
  });
  it('every N', () => {
    expect(everyFrames(100, 30)).toEqual([0, 30, 60, 90]);
    expect(() => everyFrames(100, 0)).toThrow();
  });
  it('precedence: explicit frames, then every, then count', () => {
    expect(sampleFrames({ frames: '1,2', every: 5, count: 3 }, 100, 24)).toEqual([1, 2]);
    expect(sampleFrames({ every: 50 }, 100, 24)).toEqual([0, 50]);
    expect(sampleFrames({}, 100, 5)).toHaveLength(5);
    expect(() => sampleFrames({ frames: [200] }, 100, 5)).toThrow(RangeError);
  });
  it('--scene: el muestreo queda dentro de cada Sequence de la historia, con sus bordes, sin cruzar al vecino', () => {
    const { timeline, durationInFrames } = composeStory(spec, demoScenes);
    const seen = new Map<number, string>();
    for (const e of timeline) {
      const range = sceneRange(e);
      expect(range).toEqual([e.from, e.from + e.durationInFrames - 1]);
      for (const spec_ of [{ count: 12 }, { every: 17 }, { count: 1 }, {}]) {
        const fr = sampleFrames(spec_, durationInFrames, 24, range);
        expect(fr.length).toBeGreaterThan(0);
        for (const f of fr) {
          expect(f, `${e.id} ${JSON.stringify(spec_)}`).toBeGreaterThanOrEqual(range[0]);
          expect(f).toBeLessThanOrEqual(range[1]);
        }
      }
      const fr = sampleFrames({ count: 12 }, durationInFrames, 24, range);
      expect([fr[0], fr[fr.length - 1]]).toEqual(range); // primer y ultimo cuadro de la escena
      for (const f of fr) {
        expect(seen.has(f), `el cuadro ${f} de ${e.id} ya era de ${seen.get(f)}`).toBe(false);
        seen.set(f, e.id);
      }
    }
    // cada escena pega con la siguiente: el ultimo cuadro de una es el anterior al primero de la otra
    timeline.slice(1).forEach((e, i) => expect(e.from).toBe(timeline[i]!.from + timeline[i]!.durationInFrames));
  });
  it('--scene y --frames no se combinan', () => {
    expect(() => sampleFrames({ frames: '1,2' }, 100, 24, [10, 20])).toThrow(/no se combinan/);
  });
});
