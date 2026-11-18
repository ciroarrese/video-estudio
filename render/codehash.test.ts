// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hashDir, segundosACuadros, suffixOf, videoCodeFiles, videoCodeHash } from './render';

describe('videoCodeHash (cache por video)', () => {
  it('cambia con el código del propio video y no con el de otro', async () => {
    const root = mkdtempSync(join(tmpdir(), 've-hash-'));
    try {
      const w = (f: string, t: string) => {
        mkdirSync(join(root, f, '..'), { recursive: true });
        writeFileSync(join(root, f), t);
      };
      for (const f of ['package-lock.json', 'tsconfig.json', 'vite.config.ts', 'engine/runtime/index.html', 'engine/a.ts', 'videos/uno/index.ts', 'videos/uno/escena.ts', 'videos/dos/index.ts', 'public/x.txt']) w(f, f + '1');
      const bundle = join(root, 'bundle');
      mkdirSync(bundle);
      writeFileSync(join(bundle, 've-deps.json'), JSON.stringify({ runtime: ['engine/a.ts'], videos: { 'videos/uno': ['videos/uno/index.ts', 'videos/uno/escena.ts'], 'videos/dos': ['videos/dos/index.ts'] } }));
      const h = (s: string) => videoCodeHash(root, bundle, s, { videosDir: null });
      const [uno, dos] = [await h('videos/uno'), await h('videos/dos')];
      expect(uno).not.toBe(dos);
      w('videos/dos/index.ts', 'cambió');
      expect(await h('videos/uno')).toBe(uno);
      expect(await h('videos/dos')).not.toBe(dos);
      w('videos/uno/escena.ts', 'cambió');
      expect(await h('videos/uno')).not.toBe(uno);
      const u2 = await h('videos/uno');
      w('engine/a.ts', 'cambió');
      expect(await h('videos/uno')).not.toBe(u2);
      w('public/x.txt', 'otra');
      expect(await h('videos/dos')).not.toBeNull();
      expect(await h('videos/desconocido')).toBeNull();
      expect(await h(null as never)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('la huella de código no incluye los estáticos (los sigue el manifiesto de cada parte)', () => {
  it('audio, public/ y las carpetas assets/ y audio/ del video no cambian la huella; el código y otros archivos del video sí', async () => {
    const root = mkdtempSync(join(tmpdir(), 've-hash-audio-'));
    try {
      const w = (f: string, t: string) => {
        mkdirSync(join(root, f, '..'), { recursive: true });
        writeFileSync(join(root, f), t);
      };
      for (const f of ['package-lock.json', 'tsconfig.json', 'vite.config.ts', 'engine/runtime/index.html', 'engine/a.ts', 'videos/uno/index.ts', 'videos/uno/datos.json', 'videos/uno/audio/musica.wav', 'videos/uno/audio/cues.json', 'videos/uno/audio/fuentes/original.mp4', 'videos/uno/assets/logo.png', 'public/x.txt', 'public/sfx/golpe.mp3', 'bundle/a.js', 'bundle/pista.m4a']) w(f, f + '1');
      const bundle = join(root, 'bundle');
      writeFileSync(join(bundle, 've-deps.json'), JSON.stringify({ runtime: ['engine/a.ts'], videos: { 'videos/uno': ['videos/uno/index.ts'] } }));
      const h = () => videoCodeHash(root, bundle, 'videos/uno', { videosDir: null });
      const [h0, b0] = [await h(), await hashDir(bundle, undefined, { sinAudio: true })];
      w('videos/uno/audio/musica.wav', 'otra música, más larga');
      w('public/sfx/golpe.mp3', 'otro golpe');
      w('bundle/pista.m4a', 'otra pista');
      // estáticos: un archivo nuevo o modificado en public/, assets/ o audio/ (incluida audio/fuentes/) no cambia la huella
      w('videos/uno/assets/logo.png', 'otro logo');
      w('videos/uno/assets/nuevo.png', 'suelto');
      w('videos/uno/audio/cues.json', 'otros cues');
      w('videos/uno/audio/fuentes/original.mp4', 'otro original');
      w('videos/uno/audio/fuentes/intermedio.json', 'suelto');
      w('public/x.txt', 'otro texto');
      w('public/nuevo.png', 'suelto');
      expect(await h()).toBe(h0);
      expect(await hashDir(bundle, undefined, { sinAudio: true })).toBe(b0);
      // lo que es código del video sigue contando
      w('videos/uno/datos.json', 'otros datos');
      expect(await h()).not.toBe(h0);
      const h1 = await h();
      w('videos/uno/index.ts', 'otro código');
      expect(await h()).not.toBe(h1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('videoCodeFiles da el hash de cada archivo (para explicar qué cambió) y no incluye los estáticos', async () => {
    const root = mkdtempSync(join(tmpdir(), 've-hash-files-'));
    try {
      const w = (f: string, t: string) => {
        mkdirSync(join(root, f, '..'), { recursive: true });
        writeFileSync(join(root, f), t);
      };
      for (const f of ['package-lock.json', 'tsconfig.json', 'vite.config.ts', 'engine/runtime/index.html', 'engine/a.ts', 'videos/uno/index.ts', 'videos/uno/assets/logo.png', 'public/x.txt']) w(f, f);
      const bundle = join(root, 'bundle');
      mkdirSync(bundle);
      writeFileSync(join(bundle, 've-deps.json'), JSON.stringify({ runtime: ['engine/a.ts'], videos: { 'videos/uno': ['videos/uno/index.ts'] } }));
      const r = (await videoCodeFiles(root, bundle, 'videos/uno', { videosDir: null }))!;
      expect(Object.keys(r.archivos)).toEqual(['engine/a.ts', 'engine/runtime/index.html', 'package-lock.json', 'tsconfig.json', 'videos/uno/index.ts', 'vite.config.ts']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('recorte: nombre de salida y tramo en segundos', () => {
  it('la salida por defecto de un rango lleva el rango (no pisa el video completo)', () => {
    expect(suffixOf({ frames: [20, 59] })).toBe('-f20-59');
    expect(suffixOf({ format: 'vertical', frames: [0, 9] })).toBe('-vertical-f0-9');
    expect(suffixOf({})).toBe('');
  });
  it('[desde, hasta) en segundos pasa a cuadros inclusivos, recortado al video', () => {
    expect(segundosACuadros([1, 2], 30, 300)).toEqual([30, 59]);
    expect(segundosACuadros([0.5, 1.5], 30, 300)).toEqual([15, 44]);
    expect(segundosACuadros([9, 99], 30, 300)).toEqual([270, 299]);
    expect(() => segundosACuadros([20, 30], 30, 300)).toThrow(/después del final/);
    expect(() => segundosACuadros([1, 1.001], 30, 300)).toThrow(/ningún cuadro/);
  });
});
