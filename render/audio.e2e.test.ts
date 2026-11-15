// @vitest-environment node
// Audio de punta a punta con señales sintéticas generadas acá (sin música ni archivos de nadie):
//   - pico verdadero del AAC ya multiplexado (aviso y `audioPeakStrict`);
//   - cambiar solo el audio no re-renderiza el video (el audio no entra en la clave de las partes);
//   - `--frames` y `--seconds` entregan un extracto con el audio que le corresponde, alineado al video completo.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aEstereo, pistaDeClics } from '../audio/pistas-de-prueba';
import { codificar, decodificar, picoVerdaderoDeArchivo } from '../audio/ffmpeg';
import { detectarOnsets } from '../audio/medidas';
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
const ready = hasPlaywright && has('ffmpeg', ['-version']) && has('ffprobe', ['-version']);

const SR = 48000;
const FPS = 30;
const FRAMES = 150;

const video = `import React from "react";
import { Audio, Fill, defineVideo, useFrame } from ${JSON.stringify(engineDir)};
const V = () => React.createElement(Fill, { style: { background: "#223" } }, React.createElement("div", { style: { color: "#fff", fontSize: 40 } }, "cuadro " + useFrame()), React.createElement(Audio, { src: "audio/musica.wav" }));
export default defineVideo({ id: "audio-e2e", component: V, fps: ${FPS}, width: 320, height: 180, durationInFrames: ${FRAMES} });
`;

/** Trenes de clics fuertes (cerca de 0 dBFS) a `bpm`: los clics agudos y fuertes son lo que más se pasa del pico al pasar por AAC. */
const escribirMusica = (archivo: string, bpm: number) => codificar(aEstereo(pistaDeClics({ bpm, seconds: FRAMES / FPS, sr: SR, amplitud: 0.98 })), { sr: SR, canales: 2, salida: archivo, bits: 24 });
const duracion = (f: string) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

describe.skipIf(!ready)('render con audio sintético (e2e)', () => {
  it('mide el pico del AAC, no re-renderiza al cambiar solo el audio y recorta con sonido', async () => {
    const { renderVideo } = await import('./render');
    const tmp = mkdtempSync(join(tmpdir(), 've-audio-e2e-'));
    try {
      await withTempVideos(async (dir) => {
        writeVideoFiles(dir, { 'audio-e2e/index.ts': video });
        mkdirSync(join(dir, 'audio-e2e', 'assets', 'audio'), { recursive: true });
        const wav = join(dir, 'audio-e2e', 'assets', 'audio', 'musica.wav');
        await escribirMusica(wav, 120);
        const base = { videoId: 'audio-e2e', cacheDir: join(tmp, 'cache'), concurrency: 2, segment: 30 };

        // 1. El pico del audio ya codificado se mide y avisa; con `audioPeakStrict` falla y no deja el mp4.
        const logs: string[] = [];
        const a = await renderVideo({ ...base, out: join(tmp, 'a.mp4'), log: (m) => logs.push(m) });
        expect(a.renderedSegments).toBe(5);
        expect(a.audioPeakDbtp).toBeDefined();
                const medido = await picoVerdaderoDeArchivo(join(tmp, 'a.mp4'));
        expect(medido).not.toBeNull();
        expect(Math.abs(medido! - a.audioPeakDbtp!)).toBeLessThan(0.02);
        // clics a 0,98 de la escala: el AAC los deja sobre el máximo por defecto (-1 dBTP), así que avisa
        expect(a.audioPeakDbtp!).toBeGreaterThan(-1);
        expect(logs.some((m) => /^aviso: el audio codificado llega a .* dBTP y el máximo es -1 dBTP/.test(m))).toBe(true);
        const logs2: string[] = [];
        await renderVideo({ ...base, out: join(tmp, 'a2.mp4'), audioPeakMax: 3, log: (m) => logs2.push(m) });
        expect(logs2.some((m) => m.startsWith('aviso:'))).toBe(false); // con un máximo holgado no avisa
        await expect(renderVideo({ ...base, out: join(tmp, 'estricto.mp4'), audioPeakStrict: true })).rejects.toThrow(/--audio-peak-strict/);
        expect(existsSync(join(tmp, 'estricto.mp4'))).toBe(false);
        const sinMedir = await renderVideo({ ...base, out: join(tmp, 'sm.mp4'), audioPeakCheck: false });
        expect(sinMedir.audioPeakDbtp).toBeUndefined();

        // 2. Solo cambia el audio: todas las partes de video salen de la cache y el mp4 lleva el audio nuevo.
        await escribirMusica(wav, 90);
        const b = await renderVideo({ ...base, out: join(tmp, 'b.mp4') });
        expect(b).toMatchObject({ renderedSegments: 0, cachedSegments: 5 });
        const onsets = (x: Float32Array) => detectarOnsets(x, SR);
        const ia = onsets(await decodificar(join(tmp, 'a.mp4'), { sr: SR, canales: 1 }));
        const ib = onsets(await decodificar(join(tmp, 'b.mp4'), { sr: SR, canales: 1 }));
        expect(ia.length).toBeGreaterThan(ib.length); // 120 bpm tiene más clics que 90 bpm

        // 3. Recorte con sonido: `frames` y `seconds` dan el mismo extracto, con el audio alineado al del video completo.
        const [f0, f1] = [30, 89]; // alineado a las partes (30 cuadros): se arma todo desde la cache
        const porCuadros = await renderVideo({ ...base, out: join(tmp, 'c1.mp4'), frames: [f0, f1] });
        const porSegundos = await renderVideo({ ...base, out: join(tmp, 'c2.mp4'), seconds: [f0 / FPS, (f1 + 1) / FPS] });
        expect(porCuadros).toMatchObject({ frames: 60, renderedSegments: 0 });
        expect(porSegundos.frames).toBe(60);
        for (const f of ['c1.mp4', 'c2.mp4']) {
          expect(Math.abs(duracion(join(tmp, f)) - 2)).toBeLessThan(0.01);
          const cut = onsets(await decodificar(join(tmp, f), { sr: SR, canales: 1 }));
          const t0 = f0 / FPS;
          const esperados = ib.filter((t) => t >= t0 && t < t0 + 2).map((t) => t - t0);
          // el mismo número de clics, cada uno en el mismo instante (±2 ms: el AAC mueve un poco el comienzo del ataque)
          expect(cut.length).toBe(esperados.length);
          cut.forEach((t, i) => expect(Math.abs(t - esperados[i]!)).toBeLessThan(0.002));
        }
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 900_000);
});
