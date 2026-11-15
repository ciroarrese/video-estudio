// @vitest-environment node
// `npm run exec -- script.ts`: un script de afuera del repo importa `video-estudio/*` sin tsconfig propio.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const exec = resolve(__dirname, 'exec.mjs');

describe('render/exec.mjs (scripts de afuera con el alias video-estudio/*)', () => {
  it('resuelve video-estudio/* y un solo React, pasa los argumentos y respeta el directorio de trabajo', () => {
    const dir = mkdtempSync(join(tmpdir(), 've-exec-'));
    try {
      writeFileSync(join(dir, 'uso.ts'), [
        "import { evenFrames } from 'video-estudio/qa/sampling';",
        "import { createElement } from 'react';",
        "import { renderToStaticMarkup } from 'react-dom/server';",
        "console.log(JSON.stringify({ frames: evenFrames(100, 3), html: renderToStaticMarkup(createElement('b', null, 'x')), args: process.argv.slice(2), cwd: process.cwd() }));",
      ].join('\n'));
      // INIT_CWD es lo que npm deja con el directorio desde donde se llamó; se simula sin npm para no depender de él
      const r = spawnSync(process.execPath, [exec, 'uso.ts', 'a', '--b'], { cwd: dir, env: { ...process.env, INIT_CWD: dir }, encoding: 'utf8' });
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
      const out = JSON.parse(r.stdout.trim()) as { frames: number[]; html: string; args: string[]; cwd: string };
      expect(out).toMatchObject({ frames: [0, 50, 99], html: '<b>x</b>', args: ['a', '--b'] });
      expect(out.cwd.endsWith(dir.split('/').pop()!)).toBe(true);
      expect(spawnSync(process.execPath, [exec], { encoding: 'utf8' }).status).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
