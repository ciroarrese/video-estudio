// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { serveStatic } from './server';

const base = mkdtempSync(join(tmpdir(), 've-srv-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('serveStatic', () => {
  it('keeps the runtime page when an assets dir has its own index.html; assets still resolve', async () => {
    const page = join(base, 'page');
    const assets = join(base, 'assets');
    mkdirSync(page);
    mkdirSync(join(assets, 'audio'), { recursive: true });
    writeFileSync(join(page, 'index.html'), 'RUNTIME');
    writeFileSync(join(assets, 'index.html'), 'SHADOW');
    writeFileSync(join(assets, 'audio', 'a.wav'), 'WAV');
    const srv = await serveStatic([assets, page], page);
    try {
      expect(await (await fetch(`${srv.url}/`)).text()).toBe('RUNTIME');
      expect(await (await fetch(`${srv.url}/index.html`)).text()).toBe('RUNTIME');
      expect(await (await fetch(`${srv.url}/audio/a.wav`)).text()).toBe('WAV');
      expect((await fetch(`${srv.url}/../../etc/passwd`)).status).toBe(404);
    } finally {
      await srv.close();
    }
  });
});
