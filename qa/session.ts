import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowMissingFonts, assetDirsFor, ensureBundle, explicitAssetDirs, launchChromium, metaForFormat, newRunId, pageQuery, resolveScene, sceneRange, serveStatic, type PwBrowser, type PwCdp, type PwContext, type PwPage, type VideoMeta as RenderMeta } from '../render/index';
import type { FormatName, SceneInfo } from '../engine';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type VideoMeta = RenderMeta;

export type Session = {
  meta: VideoMeta;
  pageUrl: string;
  browser: PwBrowser;
  /** Escenas con nombre del video (declaradas o juntadas de `<Sequence name>`). */
  scenes(): Promise<SceneInfo[]>;
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

export type SessionOptions = {
  videoId: string;
  props?: Record<string, unknown>;
  format?: FormatName;
  bundleDir?: string;
  /** Carpetas extra de estáticos (`--assets`); además se sirven solas `videos/<slug>/assets|audio` y `<VE_VIDEOS_DIR>/assets`. */
  assets?: string[];
  /** Borrador: una fuente que no carga solo avisa en vez de fallar. */
  allowMissingFonts?: boolean;
  log?: (m: string) => void;
};

/** Rango de cuadros de `--scene` (o todo el video si no se pidió escena). */
export async function sceneFrames(session: Session, scene?: string): Promise<[number, number] | undefined> {
  if (scene === undefined) return undefined;
  const sc = resolveScene(await session.scenes(), scene);
  return sceneRange(sc);
}

/** Serves the compiled runtime and launches Chromium (render/browser.ts + render/server.ts). */
export async function openSession(o: SessionOptions): Promise<Session> {
  const bundleDir = o.bundleDir ?? (await ensureBundle(projectRoot, join(projectRoot, '.ve-cache'), newRunId(), o.log ?? (() => {})));
  // Mismas carpetas estáticas que `render` (render/assets.ts); las del video se completan al saber su carpeta.
  const explicit = explicitAssetDirs(o.assets);
  const roots = [...assetDirsFor(projectRoot, explicit), bundleDir, join(projectRoot, 'public')];
  const server = await serveStatic(roots, bundleDir);
  let browser: PwBrowser;
  try {
    browser = await launchChromium();
  } catch (e) {
    await server.close();
    throw e;
  }
  const props = o.props ?? {};
  const pageUrl = `${server.url}/${pageQuery(o.videoId, props, o.format, { allowMissingFonts: allowMissingFonts(o) })}`;
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
  let scenesOnce: Promise<SceneInfo[]> | undefined;
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
      meta = metaForFormat(m, o.format);
      roots.splice(0, roots.length - 2, ...assetDirsFor(projectRoot, explicit, m.source));
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
    // Solo cuando se pide (recorre todos los cuadros una vez), en una pagina chica aparte.
    scenes: () =>
      (scenesOnce ??= (async () => {
        const context = await browser.newContext({ viewport: { width: 320, height: 180 }, deviceScaleFactor: 1 });
        try {
          const page = await context.newPage();
          await page.goto(pageUrl, { waitUntil: 'load' });
          await page.evaluate(() => (window as any).__ve.ready as Promise<unknown>);
          return (await page.evaluate(() => (window as any).__ve.scenes())) as SceneInfo[];
        } finally {
          await context.close().catch(() => {});
        }
      })()),
    async close() {
      await Promise.all(pages.map((p) => p.close()));
      await browser.close().catch(() => {});
      await server.close();
    },
  };
}
