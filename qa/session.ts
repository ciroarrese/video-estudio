import { join } from 'node:path';
import { launchChromium, type PwBrowser, type PwCdp, type PwContext, type PwPage } from '../render/browser';
import { serveStatic } from '../render/server';
import { ensureQaBundle, projectRoot } from './bundle';

export type VideoMeta = { id: string; fps: number; width: number; height: number; durationInFrames: number };

export type Session = {
  meta: VideoMeta;
  pageUrl: string;
  browser: PwBrowser;
  /** Opens one more page on the video (own context), ready at frame 0. */
  openPage(): Promise<VideoPage>;
  close(): Promise<void>;
};

export type VideoPage = {
  page: PwPage;
  context: PwContext;
  cdp: PwCdp;
  setFrame(n: number): Promise<void>;
  /** PNG of the stage at `scale` (1 = native size). */
  shot(scale?: number): Promise<Buffer>;
  close(): Promise<void>;
};

export type SessionOptions = { videoId: string; props?: Record<string, unknown>; bundleDir?: string; log?: (m: string) => void };

/** Serves the compiled runtime and launches Chromium (render/browser.ts + render/server.ts). */
export async function openSession(o: SessionOptions): Promise<Session> {
  const bundleDir = o.bundleDir ?? (await ensureQaBundle(projectRoot, o.log));
  const server = await serveStatic([bundleDir, join(projectRoot, 'public')], bundleDir);
  let browser: PwBrowser;
  try {
    browser = await launchChromium();
  } catch (e) {
    await server.close();
    throw e;
  }
  const props = o.props ?? {};
  const pageUrl = `${server.url}/?video=${encodeURIComponent(o.videoId)}${Object.keys(props).length ? `&props=${encodeURIComponent(JSON.stringify(props))}` : ''}`;
  const pages: VideoPage[] = [];
  const open = async (width: number, height: number): Promise<VideoPage> => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    let err: Error | null = null;
    page.on('pageerror', (e: Error) => (err ??= new Error(`Error en la pagina: ${e.message}`)));
    await page.goto(pageUrl, { waitUntil: 'load' });
    await page.evaluate(() => (window as any).__ve.ready as Promise<unknown>).then(() => undefined);
    const cdp = await context.newCDPSession(page);
    const vp: VideoPage = {
      page, context, cdp,
      async setFrame(n) {
        if (err) throw err;
        await page.evaluate((f: number) => (window as any).__ve.setFrame(f), n);
        if (err) throw err;
      },
      async shot(scale = 1) {
        const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale } });
        return Buffer.from(r.data as string, 'base64');
      },
      close: () => context.close().catch(() => {}),
    };
    pages.push(vp);
    return vp;
  };
  // Metadata through a tiny first page.
  let meta: VideoMeta;
  {
    const context = await browser.newContext({ viewport: { width: 320, height: 180 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      await page.goto(pageUrl, { waitUntil: 'load' });
      await page.evaluate(() => (window as any).__ve.ready as Promise<unknown>).then(() => undefined).catch((e: Error) => {
        throw new Error(`La pagina del video no arranco: ${e.message}`);
      });
      const metas = (await page.evaluate(() => (window as any).__ve.videos)) as VideoMeta[];
      const m = metas.find((x) => x.id === o.videoId);
      if (!m) throw new Error(`Video desconocido "${o.videoId}". Disponibles: ${metas.map((x) => x.id).join(', ')}`);
      meta = m;
    } catch (e) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
      await server.close();
      throw e;
    }
    await context.close().catch(() => {});
  }
  return {
    meta, pageUrl, browser,
    openPage: () => open(meta.width, meta.height),
    async close() {
      await Promise.all(pages.map((p) => p.close()));
      await browser.close().catch(() => {});
      await server.close();
    },
  };
}
