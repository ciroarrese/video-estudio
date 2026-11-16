import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buscarRuta, candidatasDeRuta, resolverRutaBlanda, resolverRutaVideos } from './rutas';

function montar() {
  const base = mkdtempSync(join(tmpdir(), 've-rutas-'));
  const cwd = join(base, 'clon');
  const ext = join(base, 'privado');
  mkdirSync(join(cwd, 'videos', 'otro'), { recursive: true });
  mkdirSync(join(ext, 'huella'), { recursive: true });
  writeFileSync(join(ext, 'huella', 'prohibidos.txt'), 'x');
  writeFileSync(join(cwd, 'videos', 'otro', 'lista.txt'), 'y');
  return { cwd, ext };
}

describe('rutas con VE_VIDEOS_DIR', () => {
  it('sin carpeta externa, la ruta se usa tal cual (desde cwd)', () => {
    const { cwd } = montar();
    expect(candidatasDeRuta('videos/otro/lista.txt', cwd, null)).toEqual([join(cwd, 'videos', 'otro', 'lista.txt')]);
    expect(resolverRutaVideos('videos/otro/lista.txt', cwd, null)).toBe(join(cwd, 'videos', 'otro', 'lista.txt'));
  });

  it('videos/<slug>/... se resuelve contra la carpeta externa cuando la ruta tal cual no existe', () => {
    const { cwd, ext } = montar();
    expect(resolverRutaVideos('videos/huella/prohibidos.txt', cwd, ext)).toBe(join(ext, 'huella', 'prohibidos.txt'));
    expect(resolverRutaVideos('./videos/huella', cwd, ext)).toBe(join(ext, 'huella'));
    expect(resolverRutaVideos('huella/prohibidos.txt', cwd, ext)).toBe(join(ext, 'huella', 'prohibidos.txt'));
  });

  it('gana la ruta tal cual si existe, y una absoluta se usa como viene', () => {
    const { cwd, ext } = montar();
    expect(resolverRutaVideos('videos/otro/lista.txt', cwd, ext)).toBe(join(cwd, 'videos', 'otro', 'lista.txt'));
    expect(resolverRutaVideos(join(ext, 'huella', 'prohibidos.txt'), cwd, ext)).toBe(join(ext, 'huella', 'prohibidos.txt'));
    expect(candidatasDeRuta(join(ext, 'huella'), cwd, ext)).toEqual([join(ext, 'huella')]);
  });

  it('si no existe, el error nombra las rutas probadas y la carpeta externa', () => {
    const { cwd, ext } = montar();
    expect(() => resolverRutaVideos('videos/huella/nada.txt', cwd, ext)).toThrow(/Busqué en: .*clon.*videos.*huella.*nada\.txt ; .*privado.*huella.*nada\.txt.*VE_VIDEOS_DIR/s);
    expect(() => resolverRutaVideos('videos/huella/nada.txt', cwd, null)).toThrow(/definí VE_VIDEOS_DIR/);
    expect(buscarRuta('videos/huella/nada.txt', cwd, ext)).toBeNull();
  });

  it('resolverRutaBlanda (para --assets) nunca lanza: devuelve la ruta tal cual si no hay nada', () => {
    const { cwd, ext } = montar();
    expect(resolverRutaBlanda('videos/huella', cwd, ext)).toBe(join(ext, 'huella'));
    expect(resolverRutaBlanda('videos/falta/audio', cwd, ext)).toBe(join(cwd, 'videos', 'falta', 'audio'));
  });
});
