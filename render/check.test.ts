// @vitest-environment node
// Diagnóstico de `--check`: qué elementos hay en el bbox donde difieren dos capturas, y qué elementos cambian en checkDeterminism.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bboxPoints, CHECK_HINT, groupElements } from './render';
import { engineDir, withTempVideos } from './testing';

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

describe('puntos de consulta del bbox', () => {
  it('centro y esquinas en px del escenario (se divide por la escala) y dentro del cuadro', () => {
    const p = bboxPoints([10, 20, 29, 59], 1, 100, 100);
    expect(p.map(([n]) => n)).toEqual(['centro', 'arriba-izq', 'arriba-der', 'abajo-izq', 'abajo-der']);
    expect(p[0]).toEqual(['centro', 20, 40]);
    expect(p[1]).toEqual(['arriba-izq', 10, 20]);
    expect(p[4]).toEqual(['abajo-der', 29, 59]);
    expect(bboxPoints([200, 400, 399, 799], 2, 100, 100)[0]).toEqual(['centro', 99, 99]) // 150,300 cae fuera: se recorta al cuadro;
  });
  it('agrupa los elementos repetidos y dice en qué puntos aparecen', () => {
    const pts = bboxPoints([0, 0, 9, 9], 1, 50, 50);
    const g = groupElements(pts, [['div > p "hola"', 'div'], ['div > p "hola"'], [], [], ['div']]);
    expect(g).toEqual([['div > p "hola"', ['centro', 'arriba-izq']], ['div', ['centro', 'abajo-der']]]);
  });
});

describe.skipIf(!ready)('--check dice qué elementos están en el bbox', () => {
  it('imprime elementos (etiqueta, texto, ruta, data-*), escena activa y la pista de docs/reglas.md', async () => {
    const { checkVideo } = await import('./render');
    const out = mkdtempSync(join(tmpdir(), 've-check-'));
    try {
      await withTempVideos(async (dir) => {
        mkdirSync(join(dir, 'azar'));
        // Math.random() en el render: el DOM y los píxeles dependen del historial
        writeFileSync(join(dir, 'azar', 'index.tsx'), `import React from "react";
import { defineVideo, Sequence } from ${JSON.stringify(engineDir)};
const V = () => React.createElement(Sequence, { from: 0, name: "escena-azar" },
  React.createElement("div", { style: { position: "absolute", left: 0, top: 0, width: 320, height: 180, background: "#fff" } },
    React.createElement("div", { "data-nombre": "caja", style: { position: "absolute", left: 20 + Math.floor(Math.random() * 120), top: 40, width: 60, height: 60, background: "#c00" } }, "caja roja")));
export default defineVideo({ id: "azar", component: V, fps: 30, width: 320, height: 180, durationInFrames: 12 });
`);
        const logs: string[] = [];
        const r = await checkVideo({ videoId: 'azar', cacheDir: join(out, 'cache'), log: (m) => logs.push(m) });
        const txt = logs.join('\n');
        expect(r.ok).toBe(false);
        expect(txt).toMatch(/checkDeterminism FALLA en cuadros/);
        expect(txt).toMatch(/elementos que cambian entre los dos renders[\s\S]*div > div "caja roja" \[data-nombre="caja"\]: style cambia/);
        expect(txt).toMatch(/elementos en el bbox del cuadro \d+:[\s\S]*div "caja roja" \[data-nombre="caja"\]/);
        expect(txt).toMatch(/escenas con nombre activas en el cuadro \d+: escena-azar/);
        expect(txt).toContain(CHECK_HINT);
        expect(CHECK_HINT).toContain('Qué hacer cuando --check falla');
      });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 300_000);

  it('--keep-frames: la carpeta lleva formato y escena en el nombre; sin escena ni formato, solo el id', async () => {
    const { renderVideo } = await import('./render');
    const out = mkdtempSync(join(tmpdir(), 've-keep-'));
    try {
      const base = { videoId: 'hello', frames: [0, 1] as [number, number], cacheDir: join(out, 'cache'), concurrency: 1, audio: false, keepFrames: true };
      await renderVideo({ ...base, out: join(out, 'a.mp4'), format: 'vertical', cache: false });
      expect(existsSync(join(out, 'hello-vertical-frames', '000000.png'))).toBe(true);
      await renderVideo({ ...base, out: join(out, 'b.mp4'), format: 'cuadrado', cache: false });
      expect(existsSync(join(out, 'hello-cuadrado-frames'))).toBe(true);
      expect(existsSync(join(out, 'hello-frames'))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 300_000);
});
