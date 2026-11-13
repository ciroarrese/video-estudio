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
  it('un id repetido falla con un error en español que nombra las dos carpetas', async () => {
    await expect(loadVideos({ '../../examples/x/index.ts': mk('x'), '../../videos/y/index.ts': mk('x') })).rejects.toThrow(/"x".*examples\/x.*videos\/y/);
  });
  it('un archivo roto se informa con su carpeta', async () => {
    await expect(loadVideos({ '../../videos/roto/index.ts': async () => { throw new Error('boom'); } })).rejects.toThrow(/videos\/roto.*boom/);
  });
});
