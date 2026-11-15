import { describe, expect, it } from 'vitest';
import { composeStory } from '../stories';
import { sceneRange } from '../render/meta';
import { demoScenes, spec } from '../examples/story-demo/StoryDemo';
import { anchoredFrames, evenFrames, everyFrames, parseFrameList, sampleFrames } from './sampling';

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

  describe('cuadros anclados a cada escena (estabilidad entre corridas de distinta duración)', () => {
    const escena = (id: string, from: number, durationInFrames: number) => ({ id, from, durationInFrames });
    const locales = (scenes: ReturnType<typeof escena>[], total: number, id: string) => {
      const sc = scenes.find((x) => x.id === id)!;
      return anchoredFrames(scenes, total, 4).filter((f) => f >= sc.from && f < sc.from + sc.durationInFrames).map((f) => f - sc.from);
    };
    it('los desplazamientos locales de una escena no cambian aunque cambie lo que la precede o la sigue', () => {
      const corrida1 = [escena('intro', 0, 150), escena('tablero', 150, 600), escena('cierre', 750, 200)];
      const corrida2 = [escena('intro', 0, 90), escena('tablero', 90, 600), escena('cierre', 690, 320)]; // otra duración total y otra posición
      expect(locales(corrida1, 950, 'tablero')).toEqual([2, 10, 24, 599]);
      expect(locales(corrida2, 1010, 'tablero')).toEqual(locales(corrida1, 950, 'tablero'));
      // el muestreo repartido de la misma pareja de corridas sí cae en otros cuadros locales
      const rel = (total: number, from: number) => evenFrames(total, 24).filter((f) => f >= from && f < from + 600).map((f) => f - from);
      expect(rel(1010, 90)).not.toEqual(rel(950, 150));
    });
    it('se suman al muestreo repartido sin duplicar; con count 0 quedan solos; sin escenas count 0 falla', () => {
      const sc = [escena('a', 0, 100), escena('b', 100, 100)];
      const anc = anchoredFrames(sc, 200, 4);
      expect(anc).toEqual([2, 10, 24, 99, 102, 110, 124, 199]);
      const todo = sampleFrames({ count: 5 }, 200, 24, undefined, anc);
      expect(todo).toEqual([...new Set([...evenFrames(200, 5), ...anc])].sort((a, b) => a - b));
      expect(sampleFrames({ count: 0 }, 200, 24, undefined, anc)).toEqual(anc);
      expect(() => sampleFrames({ count: 0 }, 200, 24)).toThrow(/--count 0/);
      // cuadros pedidos, paso o una escena sola: no se agrega nada
      expect(sampleFrames({ frames: '5,6' }, 200, 24, undefined, anc)).toEqual([5, 6]);
      expect(sampleFrames({ every: 100 }, 200, 24, undefined, anc)).toEqual([0, 100]);
      expect(anchoredFrames(sc, 200, 0)).toEqual([]);
    });
    it('escenas que se pasan del final o muy cortas no dan cuadros fuera del video', () => {
      const f = anchoredFrames([escena('largo', 90, 500), escena('corta', 0, 5)], 100, 6);
      expect(f.every((x) => x >= 0 && x < 100)).toBe(true);
      expect(new Set(f).size).toBe(f.length);
      expect(f.slice(0, 5)).toEqual([0, 1, 2, 3, 4]); // la escena de 5 cuadros da todos
      expect(f.filter((x) => x >= 90)[0]).toBe(92); // la de 90 recortada al final del video (10 cuadros) conserva su desplazamiento de entrada
    });
  });
});
