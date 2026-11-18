// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { archivoDeRegistro, explicarCambio, guardarRegistro, leerRegistro, type RegistroClave } from './motivos';

const base: RegistroClave = { codigo: 'aaa', archivos: { 'videos/x/a.ts': '1', 'kit/k.ts': '1' }, props: '{}', scale: 1, crf: 18, segment: 150, env: { ffmpeg: 'v6', fps: 30, format: 'horizontal' } };

describe('explicarCambio', () => {
  it('sin entrada anterior', () => {
    expect(explicarCambio(null, base)).toEqual([expect.stringContaining('no había entrada')]);
  });
  it('ingredientes iguales: no hay motivo de cambio (la parte simplemente no estaba)', () => {
    expect(explicarCambio(base, { ...base })).toEqual([]);
  });
  it('nombra los archivos de código que cambiaron', () => {
    const ahora = { ...base, codigo: 'bbb', archivos: { 'videos/x/a.ts': '2', 'kit/k.ts': '1', 'videos/x/nuevo.ts': '1' } };
    expect(explicarCambio(base, ahora)).toEqual(['cambió el código del video (videos/x/a.ts, videos/x/nuevo.ts)']);
  });
  it('sin huella por video, dice que cambió el bundle', () => {
    expect(explicarCambio({ ...base, archivos: undefined }, { ...base, codigo: 'bbb', archivos: undefined })).toEqual([expect.stringContaining('cambió el bundle')]);
  });
  it('props, escala, crf, formato y opciones', () => {
    const ahora = { ...base, props: '{"a":1}', scale: 0.5, crf: 23, env: { ffmpeg: 'v7', fps: 30, format: 'vertical' } };
    const m = explicarCambio(base, ahora).join(' | ');
    expect(m).toContain('cambiaron las props');
    expect(m).toContain('cambió la escala (1 -> 0.5)');
    expect(m).toContain('cambió el crf (18 -> 23)');
    expect(m).toContain('cambió el formato u opciones de render (la versión de ffmpeg, el formato (horizontal, vertical, cuadrado))');
  });
  it('resume cuando hay muchos archivos', () => {
    const archivos = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`f${i}.ts`, 'x']));
    expect(explicarCambio({ ...base, archivos: {} }, { ...base, codigo: 'z', archivos })[0]).toBe('cambió el código del video (f0.ts, f1.ts, f2.ts, f3.ts y 3 más)');
  });
});

describe('registro en disco', () => {
  it('se guarda y se lee; un archivo roto da null; el nombre depende del video y el formato', () => {
    const dir = mkdtempSync(join(tmpdir(), 've-motivos-'));
    try {
      const f = archivoDeRegistro(dir, 'hola', undefined);
      expect(f).not.toBe(archivoDeRegistro(dir, 'hola', 'vertical'));
      expect(leerRegistro(f)).toBeNull();
      guardarRegistro(f, base);
      expect(leerRegistro(f)).toEqual(base);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
