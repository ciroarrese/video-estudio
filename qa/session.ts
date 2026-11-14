import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanPageError, allowMissingFonts, assetDirsFor, ensureBundle, explicitAssetDirs, launchChromium, metaForFormat, newRunId, NOSTAGE_QUERY, pageQuery, resolveScene, sceneRange, serveStatic, type PwBrowser, type PwCdp, type PwContext, type PwPage, type VideoMeta as RenderMeta } from '../render/index';
import { cacheDirPorDefecto } from '../render/dirs';
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

/**
 * Prueba de estres de tipografia, hecha solo desde la pagina del control (sin tocar el motor): `fontScale` multiplica el tamano de letra de
 * todo elemento con texto (despues de cada cambio de cuadro) y `fontFallback` reemplaza la pila de fuentes de todo por una ancha o una angosta,
 * para encontrar maquetaciones que asumen las medidas de una tipografia. No cubre el texto de canvas ni el que se mide en JS con otra fuente.
 */
export type Stress = { fontScale?: number; fontFallback?: 'wide' | 'narrow' };

/** Pilas de reemplazo: `wide` ensancha (Verdana-like, la mas ancha instalada), `narrow` angosta (condensada). */
export const FALLBACK_STACKS: Record<'wide' | 'narrow', string> = {
  wide: '"Verdana", "DejaVu Sans", "Bitstream Vera Sans", sans-serif',
  narrow: '"Arial Narrow", "Liberation Sans Narrow", "DejaVu Sans Condensed", "Nimbus Sans Narrow", sans-serif',
};

/** Se evalua en la pagina despues de cada `setFrame`: restaura el tamano de letra que puso el estres antes y vuelve a aplicarlo. Plain JS. */
const APPLY_FONT_SCALE = `(function(scale){
  var S = window.__qaStress || (window.__qaStress = { els: [] });
  S.els.forEach(function (rec) {
    var el = rec.el;
    if (!el.isConnected) return;
    // si React reescribio el tamano en este cuadro, el valor ya no es el nuestro: no se pisa
    if (el.style.getPropertyValue('font-size') !== rec.mine || el.style.getPropertyPriority('font-size') !== 'important') return;
    if (rec.val) el.style.setProperty('font-size', rec.val, rec.pri); else el.style.removeProperty('font-size');
  });
  S.els = [];
  var root = document.getElementById('stage') || document.body;
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  var seen = new Set(), list = [], n;
  while ((n = walker.nextNode())) {
    if (!n.data.trim()) continue;
    var el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    list.push([el, parseFloat(getComputedStyle(el).fontSize)]);
  }
  list.forEach(function (p) {
    var el = p[0], mine = (p[1] * scale).toFixed(3) + 'px';
    S.els.push({ el: el, val: el.style.getPropertyValue('font-size'), pri: el.style.getPropertyPriority('font-size'), mine: mine });
    el.style.setProperty('font-size', mine, 'important');
  });
})`;

export type SessionOptions = {
  videoId: string;
  props?: Record<string, unknown>;
  format?: FormatName;
  bundleDir?: string;
  /** Carpetas extra de estáticos (`--assets`); además se sirven solas `videos/<slug>/assets|audio` y `<VE_VIDEOS_DIR>/assets`. */
  assets?: string[];
  /** Borrador: una fuente que no carga solo avisa en vez de fallar. */
  allowMissingFonts?: boolean;
  /** Estres de tipografia (ver `Stress`). */
  stress?: Stress;
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
  const bundleDir = o.bundleDir ?? (await ensureBundle(projectRoot, cacheDirPorDefecto(projectRoot), newRunId(), o.log ?? (() => {})));
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
    await page.evaluate(() => (window as any).__ve.ready as Promise<unknown>).then(() => undefined, (e: Error) => {
      throw new Error(`La pagina del video no arranco: ${cleanPageError(e.message)}`);
    });
    if (o.stress?.fontFallback) {
      const css = `*,*::before,*::after{font-family:${FALLBACK_STACKS[o.stress.fontFallback]} !important}`;
      await (page.evaluate as unknown as (e: string) => Promise<unknown>)(`(()=>{const s=document.createElement('style');s.id='__qa_fallback';s.textContent=${JSON.stringify(css)};document.head.appendChild(s);})()`);
    }
    const scale = o.stress?.fontScale;
    const applyScale = async () => { if (scale !== undefined && scale !== 1) await (page.evaluate as unknown as (e: string) => Promise<unknown>)(`(${APPLY_FONT_SCALE})(${scale})`); };
    const cdp = await context.newCDPSession(page);
    const vp: VideoPage = {
      page, context, cdp,
      async setFrame(n) {
        if (err) throw err;
        await page.evaluate((f: number) => (window as any).__ve.setFrame(f), n);
        await applyScale();
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
      // Página que solo registra los videos (no dibuja): da la carpeta de origen antes de que se pida ninguna fuente o imagen.
      await page.goto(`${server.url}/${NOSTAGE_QUERY}`, { waitUntil: 'load' });
      await page.evaluate(() => (window as any).__ve.ready as Promise<unknown>).then(() => undefined).catch((e: Error) => {
        throw new Error(`La pagina del video no arranco: ${cleanPageError(e.message)}`);
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
