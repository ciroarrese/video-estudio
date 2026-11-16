import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { entrada, salida } from './rutas';

describe('rutas de audio con VE_VIDEOS_DIR', () => {
  const base = mkdtempSync(join(tmpdir(), 've-rutas-'));
  const cwd = join(base, 'repo');
  const ext = join(base, 'afuera');
  mkdirSync(cwd, { recursive: true });
  mkdirSync(join(ext, 'mi-video', 'audio'), { recursive: true });
  writeFileSync(join(ext, 'mi-video', 'cues.json'), '[]');

  it('una entrada videos/<slug>/... se busca en la carpeta externa', () => {
    expect(entrada('videos/mi-video/cues.json', cwd, ext)).toBe(join(ext, 'mi-video', 'cues.json'));
  });
  it('una entrada que no existe nombra lo probado', () => {
    expect(() => entrada('videos/mi-video/nada.json', cwd, ext)).toThrow(/VE_VIDEOS_DIR/);
  });
  it('una entrada que existe tal cual no se traduce', () => {
    mkdirSync(join(cwd, 'videos', 'otro'), { recursive: true });
    writeFileSync(join(cwd, 'videos', 'otro', 'a.json'), '[]');
    expect(entrada('videos/otro/a.json', cwd, ext)).toBe(join(cwd, 'videos', 'otro', 'a.json'));
  });
  it('una salida en una carpeta que existe afuera cae afuera', () => {
    expect(salida('videos/mi-video/audio/mezcla.wav', cwd, ext)).toBe(join(ext, 'mi-video', 'audio', 'mezcla.wav'));
  });
  it('una salida out/... con carpeta externa cae en <afuera>/out, aunque exista out/ en el directorio actual', () => {
    mkdirSync(join(cwd, 'out'), { recursive: true });
    expect(salida('out/x.srt', cwd, ext)).toBe(join(ext, 'out', 'x.srt'));
    expect(salida('out/x.srt', cwd, null)).toBe(join(cwd, 'out', 'x.srt'));
  });
  it('una salida en una carpeta que falta pero cuyo video existe afuera cae afuera', () => {
    expect(salida('videos/mi-video/sfx/x.wav', cwd, ext)).toBe(join(ext, 'mi-video', 'sfx', 'x.wav'));
  });
  it('sin carpeta externa es la ruta tal cual y una absoluta no se toca', () => {
    expect(salida('videos/x/y.wav', cwd, null)).toBe(join(cwd, 'videos', 'x', 'y.wav'));
    expect(salida(join(ext, 'a.wav'), cwd, ext)).toBe(join(ext, 'a.wav'));
  });
});
