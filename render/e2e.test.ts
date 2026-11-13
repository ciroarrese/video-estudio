// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

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
const ready = hasPlaywright && has('ffmpeg', ['-version']) && has('ffprobe', ['-version']) ;

// Needs Chromium + ffmpeg + a built dist/: skipped otherwise.
describe.skipIf(!ready)('renderVideo (e2e)', () => {
  it('renders a short range (cache dir with a % in its name) and reuses the cache', async () => {
    const { renderVideo } = await import('./render');
    const dir = mkdtempSync(join(tmpdir(), 've-e2e-'));
    mkdirSync(join(dir, '100%d cache'));
    try {
      const opts = { videoId: 'hello', frames: [0, 9] as [number, number], out: join(dir, 'o.mp4'), cacheDir: join(dir, '100%d cache'), concurrency: 2, audio: false };
      const a = await renderVideo(opts);
      expect(a).toMatchObject({ frames: 10, renderedSegments: 1, cachedSegments: 0 });
      const b = await renderVideo(opts);
      expect(b).toMatchObject({ renderedSegments: 0, cachedSegments: 1 });
      const n = execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', opts.out]).toString().trim();
      expect(n).toBe('10');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 300_000);
});
