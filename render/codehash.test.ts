// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { videoCodeHash } from './render';

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
      const h = (s: string) => videoCodeHash(root, bundle, s);
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
