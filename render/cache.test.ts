// @vitest-environment node
// Caché de partes de punta a punta (Chromium + ffmpeg): un estático suelto no invalida, uno usado sí, y `render` dice por qué; copia liviana.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { engineDir, withTempVideos, writeVideoFiles } from './testing';

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

const svg = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${color}"/></svg>`;
// segunda mitad del video usa b.svg; la primera, a.svg
const video = (extra = '') => `import React from "react";
import { defineVideo, useFrame, asset } from ${JSON.stringify(engineDir)};
const V = () => { const f = useFrame(); return React.createElement("div", { style: { width: 320, height: 180, background: "#fff" } }, React.createElement("img", { src: asset(f < 45 ? "a.svg" : "b.svg"), width: 100, height: 100 }), "${extra}", f); };
export default defineVideo({ id: "est", component: V, fps: 30, width: 320, height: 180, durationInFrames: 90 });
`;

describe.skipIf(!ready)('caché por estáticos usados (render real)', () => {
  it('un archivo suelto no rehace nada; cambiar un estático usado rehace y dice cuál; cambiar el código dice qué archivo; liviano', async () => {
    const { renderVideo } = await import('./index');
    await withTempVideos(async (dir) => {
      writeVideoFiles(dir, { 'est/index.tsx': video(), 'assets/a.svg': svg('red'), 'assets/b.svg': svg('blue') });
      const tmp = mkdtempSync(join(tmpdir(), 've-cache-'));
      try {
        const logs: string[] = [];
        const base = { videoId: 'est', cacheDir: join(tmp, 'c'), out: join(tmp, 'est.mp4'), segment: 45, concurrency: 2, audio: false, log: (m: string) => void logs.push(m) };
        const r1 = await renderVideo(base);
        expect([r1.renderedSegments, r1.cachedSegments]).toEqual([2, 0]);
        expect(logs.join('\n')).toMatch(/caché: 2 partes sin entrada: no había entrada en la caché para este video/);

        // una pista original, un intermedio y un estático que ningún cuadro pide: no cambia nada
        writeVideoFiles(dir, { 'assets/suelto.txt': 'x', 'est/audio/fuentes/original.mp4': 'x', 'est/audio/cues.json': '{}', 'assets/otro.svg': svg('green') });
        const r2 = await renderVideo({ ...base, log: undefined });
        expect([r2.renderedSegments, r2.cachedSegments]).toEqual([0, 2]);

        // un estático que sí se usa cambia: se rehace y se dice cuál
        logs.length = 0;
        writeFileSync(join(dir, 'assets', 'b.svg'), svg('green'));
        const r3 = await renderVideo({ ...base, log: (m) => void logs.push(m) });
        expect(r3.renderedSegments).toBeGreaterThan(0);
        expect(logs.join('\n')).toMatch(/caché: \d partes? invalidadas?: cambió el estático \/b\.svg/);
        const r4 = await renderVideo({ ...base, log: undefined });
        expect([r4.renderedSegments, r4.cachedSegments]).toEqual([0, 2]);

        // cambia el código: el motivo nombra el archivo
        logs.length = 0;
        writeVideoFiles(dir, { 'est/index.tsx': video('x') });
        const r5 = await renderVideo({ ...base, log: (m) => void logs.push(m) });
        expect(r5.renderedSegments).toBe(2);
        expect(logs.join('\n')).toMatch(/sin entrada: cambió el código del video \(videos\/est\/index\.tsx\)/);

        // otras opciones: el motivo lo dice
        logs.length = 0;
        await renderVideo({ ...base, crf: 30, log: (m) => void logs.push(m) });
        expect(logs.join('\n')).toMatch(/cambió el crf \(18 -> 30\)/);
        logs.length = 0;
        await renderVideo({ ...base, cache: false, log: (m) => void logs.push(m) });
        expect(logs.join('\n')).toMatch(/caché: desactivada \(--no-cache\)/);

        // copia liviana: al lado de la salida, por debajo del tope
        const grande = statSync(join(tmp, 'est.mp4')).size;
        const topeMb = Math.floor((grande * 0.85 / 1048576) * 100000) / 100000;
        const r6 = await renderVideo({ ...base, log: undefined, liviano: topeMb });
        expect(r6.liviano?.out).toBe(join(tmp, 'est-liviano.mp4'));
        expect(existsSync(join(tmp, 'est-liviano.mp4'))).toBe(true);
        expect(statSync(join(tmp, 'est-liviano.mp4')).size).toBeLessThanOrEqual(topeMb * 1048576);
        expect(r6.liviano?.ok).toBe(true);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  }, 300_000);
});
