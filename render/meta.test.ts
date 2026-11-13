import { describe, expect, it } from 'vitest';
import { metaForFormat, parseFormat, resolveScene, formatSceneList } from './meta';
import { parseCliArgs } from './args';
import { sampleFrames } from '../qa/sampling';
import { suffixOf } from './render';

const meta = { id: 'v', fps: 30, width: 1920, height: 1080, durationInFrames: 100, format: 'horizontal' as const, formats: { horizontal: { width: 1920, height: 1080 }, vertical: { width: 1080, height: 1920 } } };
const scenes = [{ id: 'a', from: 0, durationInFrames: 30 }, { id: 'b', name: 'Tema B', from: 30, durationInFrames: 70 }];

describe('formatos y escenas en el CLI', () => {
  it('parsea y valida --format', () => {
    expect(parseFormat(undefined)).toBeUndefined();
    expect(parseFormat('vertical')).toBe('vertical');
    expect(() => parseFormat('panorama')).toThrow(/--format/);
  });
  it('elige el tamaño del formato o explica qué falta', () => {
    expect(metaForFormat(meta)).toMatchObject({ width: 1920, format: 'horizontal' });
    expect(metaForFormat(meta, 'vertical')).toMatchObject({ width: 1080, height: 1920, format: 'vertical' });
    expect(() => metaForFormat(meta, 'cuadrado')).toThrow(/no admite el formato "cuadrado".*horizontal, vertical/);
  });
  it('resuelve escenas por id, nombre o índice (desde 0)', () => {
    expect(resolveScene(scenes, 'b')).toMatchObject({ from: 30, index: 1 });
    expect(resolveScene(scenes, 'Tema B').id).toBe('b');
    expect(resolveScene(scenes, '0').id).toBe('a');
    expect(() => resolveScene(scenes, '2')).toThrow(/índice 2/);
    expect(() => resolveScene(scenes, 'zzz')).toThrow(/Disponibles: a, b/);
    expect(() => resolveScene([], 'a')).toThrow(/no tiene escenas/);
    expect(() => resolveScene([...scenes, { id: 'a', from: 5, durationInFrames: 1 }], 'a')).toThrow(/repetida/);
    expect(formatSceneList('v', scenes, 30)).toContain('cuadros 30-99');
  });
  it('args: --format, --scene, --list, --list-scenes; --scene y --frames no se combinan', () => {
    expect(parseCliArgs(['v', '--format', 'vertical', '--scene', 'b'])).toMatchObject({ format: 'vertical', scene: 'b', list: false });
    expect(parseCliArgs(['--list'])).toMatchObject({ list: true });
    expect(parseCliArgs(['v', '--list-scenes']).listScenes).toBe(true);
    expect(() => parseCliArgs(['v', '--scene', 'b', '--frames', '1-2'])).toThrow(/no se combinan/);
    expect(() => parseCliArgs(['v', '--format', 'x'])).toThrow(/--format/);
  });
  it('muestrea dentro de una escena', () => {
    expect(sampleFrames({ count: 3 }, 100, 12, [30, 99])).toEqual([30, 65, 99]);
    expect(sampleFrames({ every: 20 }, 100, 12, [30, 99])).toEqual([30, 50, 70, 90]);
    expect(() => sampleFrames({ frames: '1,2' }, 100, 12, [30, 99])).toThrow(/no se combinan/);
  });
  it('nombre de salida con formato y escena', () => {
    expect(suffixOf({})).toBe('');
    expect(suffixOf({ format: 'vertical', scene: 'Tema B' }, 3)).toBe('-vertical-Tema_B-3'); // se cambió el nombre: lleva el índice
    expect(suffixOf({ scene: 'intro' }, 0)).toBe('-intro'); // sin cambios, queda tal cual
  });
  it('`a b` y `a/b` no caen en el mismo archivo', () => {
    expect(suffixOf({ scene: 'a b' }, 1)).not.toBe(suffixOf({ scene: 'a/b' }, 2));
    expect(suffixOf({ scene: 'a b' })).not.toBe(suffixOf({ scene: 'a/b' })); // sin índice: hash corto del nombre
    expect(suffixOf({ scene: 'a_b' })).not.toBe(suffixOf({ scene: 'a b' }));
  });
});
