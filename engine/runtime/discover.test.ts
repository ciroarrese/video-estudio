import { beforeEach, describe, expect, it } from 'vitest';
import { clearVideos, defineVideo, getVideos } from '../defineVideo';
import { folderOf, loadVideos } from './discover';

const mk = (id: string) => async () => void defineVideo({ id, component: () => null, fps: 30, width: 10, height: 10, durationInFrames: 5 });

describe('loadVideos', () => {
  beforeEach(clearVideos);
  it('calcula la carpeta de cada ruta', () => {
    expect(folderOf('../../videos/foo/index.ts')).toBe('videos/foo');
    expect(folderOf('../../videos/foo/escena/index.tsx')).toBe('videos/foo/escena');
    expect(folderOf('../../examples/hello/index.ts')).toBe('examples/hello');
  });
  it('registra todo, con su carpeta, y funciona sin ningún video', async () => {
    await loadVideos({});
    expect(getVideos()).toEqual([]);
    await loadVideos({ '../../videos/b/index.ts': mk('b'), '../../examples/a/index.ts': mk('a') });
    expect(getVideos().map((v) => [v.id, v.source])).toEqual([['a', 'examples/a'], ['b', 'videos/b']]);
  });
  it('un id repetido no corta la carga: se informa con las dos carpetas y se sigue con el resto', async () => {
    const errs = await loadVideos({ '../../examples/x/index.ts': mk('x'), '../../videos/y/index.ts': mk('x'), '../../videos/z/index.ts': mk('z') });
    expect(errs).toHaveLength(1);
    expect(errs[0]!.message).toMatch(/"x".*examples\/x.*videos\/y/);
    expect(errs[0]!.ids).toEqual(['x']);
    expect(errs[0]!.folders).toEqual(['examples/x', 'videos/y']);
    expect(getVideos().map((v) => v.id)).toEqual(['x', 'z']); // z cargó igual, después del error
  });
  it('un archivo roto se informa con su carpeta y los videos de después cargan', async () => {
    const errs = await loadVideos({
      '../../videos/a/index.ts': mk('a'),
      '../../videos/roto/index.ts': async () => { throw new Error('boom'); },
      '../../videos/z/index.ts': mk('z'),
    });
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatchObject({ folder: 'videos/roto', ids: [] });
    expect(errs[0]!.message).toMatch(/videos\/roto.*boom/);
    expect(getVideos().map((v) => v.id)).toEqual(['a', 'z']);
  });
  it('si la carpeta rota alcanzó a registrar un id, queda como comprometido', async () => {
    const errs = await loadVideos({ '../../videos/m/index.ts': async () => { await mk('m')(); throw new Error('tarde'); } });
    expect(errs[0]!.ids).toEqual(['m']);
  });
  it('traduce el prefijo de VE_VIDEOS_DIR a videos/', () => {
    expect(folderOf('../../../.ve-cache/tmp/a/index.ts', '../../../.ve-cache/tmp')).toBe('videos/a');
    expect(folderOf('../../../.ve-cache/tmp/a/b/index.tsx', '../../../.ve-cache/tmp')).toBe('videos/a/b');
  });
});
