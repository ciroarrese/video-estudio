import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cacheDirPorDefecto, limpiar, outDirPorDefecto, notaCarpetaExterna, resolverSalida, salidaPorDefecto } from './dirs';

const claves = ['VE_VIDEOS_DIR', 'VE_CACHE_DIR', 'VE_OUT_DIR'] as const;
const guardadas = Object.fromEntries(claves.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of claves) {
    if (guardadas[k] === undefined) delete process.env[k];
    else process.env[k] = guardadas[k];
  }
});
const limpio = () => claves.forEach((k) => delete process.env[k]);

describe('carpetas de cache y salida', () => {
  it('sin VE_VIDEOS_DIR: .ve-cache del clon y out/ del directorio actual', () => {
    limpio();
    expect(cacheDirPorDefecto('/clon')).toBe(join('/clon', '.ve-cache'));
    expect(outDirPorDefecto()).toBe(resolve('out'));
  });

  it('con VE_VIDEOS_DIR: todo cuelga de la carpeta externa, nada del clon', () => {
    limpio();
    process.env.VE_VIDEOS_DIR = '/privado/videos';
    expect(cacheDirPorDefecto('/clon')).toBe(join(resolve('/privado/videos'), '.ve-cache'));
    expect(salidaPorDefecto('a.mp4')).toBe(join(resolve('/privado/videos'), 'out', 'a.mp4'));
  });

  it('VE_CACHE_DIR y VE_OUT_DIR mandan sobre todo lo demás', () => {
    limpio();
    process.env.VE_VIDEOS_DIR = '/privado/videos';
    process.env.VE_CACHE_DIR = '/otra/cache';
    process.env.VE_OUT_DIR = '/otra/salida';
    expect(cacheDirPorDefecto('/clon')).toBe(resolve('/otra/cache'));
    expect(salidaPorDefecto('a.mp4')).toBe(join(resolve('/otra/salida'), 'a.mp4'));
  });

  it('resolverSalida: sin variables, relativa al directorio actual; absoluta, tal cual', () => {
    expect(resolverSalida('out/x.mp4', '/trabajo', {})).toBe(resolve('/trabajo', 'out', 'x.mp4'));
    expect(resolverSalida('x.mp4', '/trabajo', { VE_VIDEOS_DIR: '' })).toBe(resolve('/trabajo', 'x.mp4'));
    expect(resolverSalida('/abs/x.mp4', '/trabajo', { VE_VIDEOS_DIR: '/priv' })).toBe('/abs/x.mp4');
  });

  it('resolverSalida con VE_VIDEOS_DIR: `out/` es la carpeta de salidas externa y el resto cuelga de la carpeta externa', () => {
    const env = { VE_VIDEOS_DIR: '/priv/videos' };
    expect(resolverSalida('out/x.mp4', '/clon', env)).toBe(join(resolve('/priv/videos'), 'out', 'x.mp4'));
    expect(resolverSalida('./out/sub/x.mp4', '/clon', env)).toBe(join(resolve('/priv/videos'), 'out', 'sub', 'x.mp4'));
    expect(resolverSalida('out\\x.mp4', '/clon', env)).toBe(join(resolve('/priv/videos'), 'out', 'x.mp4'));
    expect(resolverSalida('salidas/x.mp4', '/clon', env)).toBe(join(resolve('/priv/videos'), 'salidas', 'x.mp4'));
    expect(resolverSalida('outro/x.mp4', '/clon', env)).toBe(join(resolve('/priv/videos'), 'outro', 'x.mp4'));
  });

  it('resolverSalida con VE_OUT_DIR manda sobre VE_VIDEOS_DIR para `out/`; sola, también sirve', () => {
    expect(resolverSalida('out/x.mp4', '/clon', { VE_VIDEOS_DIR: '/priv', VE_OUT_DIR: '/sal' })).toBe(join(resolve('/sal'), 'x.mp4'));
    expect(resolverSalida('x.mp4', '/clon', { VE_OUT_DIR: '/sal' })).toBe(join(resolve('/sal'), 'x.mp4'));
    expect(resolverSalida('out/a/x.mp4', '/clon', { VE_OUT_DIR: '/sal' })).toBe(join(resolve('/sal'), 'a', 'x.mp4'));
  });

  it('notaCarpetaExterna avisa dónde viven realmente las carpetas `videos/<slug>`', () => {
    expect(notaCarpetaExterna(null)).toBeNull();
    expect(notaCarpetaExterna('/priv/videos')).toContain('`/priv/videos/<slug>`');
  });

  it('limpiar borra las del clon y las de afuera, y solo esas', () => {
    limpio();
    const base = mkdtempSync(join(tmpdir(), 've-clean-'));
    try {
      const clon = join(base, 'clon');
      const ext = join(base, 'ext');
      for (const d of [join(clon, '.ve-cache'), join(clon, 'out'), join(ext, '.ve-cache'), join(ext, 'out'), join(ext, 'slug')]) mkdirSync(d, { recursive: true });
      process.env.VE_VIDEOS_DIR = ext;
      expect(limpiar(clon, { dryRun: true })).toHaveLength(4);
      expect(limpiar(clon)).toHaveLength(4);
      expect(existsSync(join(clon, 'out'))).toBe(false);
      expect(existsSync(join(ext, '.ve-cache'))).toBe(false);
      expect(existsSync(join(ext, 'slug'))).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
