// @vitest-environment node
// `--check` por escena (apertura, primera vuelta, cierre) de historias con títulos, temas y etiquetas muy distintos.
// El muestreo por defecto de una historia entera (12 cuadros parejos) puede saltearse un fallo de la apertura que `--scene opening` sí ve,
// así que acá se verifica cada bloque por separado. Cada caso es un video temporal (carpeta propia, id propio) con su `StorySpec`.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTempVideos } from '../render/testing';
import { CASES, videoFile } from './determinism.cases';

const has = (cmd: string, args: string[]) => {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const hasPlaywright = (() => {
  try {
    createRequire(import.meta.url)('playwright');
    return true;
  } catch {
    return false;
  }
})();
const ready = hasPlaywright && has('ffmpeg', ['-version']);

describe.skipIf(!ready)('historias: --check por escena (apertura, vuelta, cierre) con varios títulos', () => {
  it('todas las escenas generadas son deterministas', async () => {
    const { checkVideo } = await import('../render/render');
    const out = mkdtempSync(join(tmpdir(), 've-story-det-'));
    try {
      await withTempVideos(async (dir) => {
        for (const c of CASES) {
          mkdirSync(join(dir, c.id));
          writeFileSync(join(dir, c.id, 'index.tsx'), videoFile(c));
        }
        const failures: string[] = [];
        for (const c of CASES) {
          for (const scene of ['opening', 'interlude-1', 'closing']) {
            const logs: string[] = [];
            const r = await checkVideo({ videoId: c.id, scene, cacheDir: join(out, 'cache'), log: (m) => logs.push(m) });
            if (!r.ok) failures.push(`${c.id} / ${scene}\n${logs.filter((l) => /FALLA|DIFERENTE|cambian|elementos|style/.test(l)).slice(0, 8).join('\n')}`);
          }
        }
        expect(failures, failures.join('\n---\n')).toEqual([]);
      });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 1_800_000);
});
