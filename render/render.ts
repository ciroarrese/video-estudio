import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { cpus } from 'node:os';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparePngs, DEFAULT_TOLERANCE, formatDiff, withinTolerance, type CheckTolerance } from './compare';
import { buildAudioGraph, resolveSrc, windowTracks, type Track } from './audio';
import { launchChromium, type PwBrowser, type PwPage } from './browser';
import { FileHashCache } from './filehash';
import { trackChild, trackCloser, trackPath, untrackPath } from './cleanup';
import { digestFiles, ENCODER_SETTINGS, frameFile, planCheckFrames, framePattern, planSegments, planShards, segmentKey } from './plan';
import { serveStatic } from './server';
import { assetDirsFor, explicitAssetDirs } from './assets';
import { cacheDirPorDefecto, salidaPorDefecto } from './dirs';
import { cleanPageError, metaForFormat, NOSTAGE_QUERY, pageQuery, resolveScene, sceneRange, type VideoMeta } from './meta';
import type { FormatName, SceneInfo } from '../engine';

export type RenderOptions = {
  videoId: string;
  /** Output file (default out/<id>.mp4 relative to cwd). */
  out?: string;
  props?: Record<string, unknown>;
  /** Inclusive frame range. */
  frames?: [number, number];
  concurrency?: number;
  scale?: number;
  crf?: number;
  segment?: number;
  audio?: boolean;
  cache?: boolean;
  keepFrames?: boolean;
  /** Frame capture format: lossless png (default) or jpeg (faster, lossy). */
  frameFormat?: 'png' | 'jpeg';
  jpegQuality?: number;
  /** `--check` tolerance for the PNG comparison (defaults: delta <= 2, <= 0.1% of pixels). */
  checkMaxDelta?: number;
  checkMaxRatio?: number;
  checkStrict?: boolean;
  /** `--check`: cuadros repartidos parejos (12), cuadros por escena con nombre (6) o todos. Ver `planCheckFrames`. */
  checkCount?: number;
  checkPerScene?: number;
  checkAll?: boolean;
  /** Extra static / audio directories (searched first). Además se sirven solas `videos/<slug>/assets|audio` y `<VE_VIDEOS_DIR>/assets` (ver render/assets.ts). */
  assets?: string[];
  /** Borrador: una fuente que no carga solo avisa en vez de fallar (también VE_ALLOW_MISSING_FONTS=1). */
  allowMissingFonts?: boolean;
  /** Formato de pantalla (`horizontal`, `vertical`, `cuadrado`); sin esto, el formato base del video. */
  format?: FormatName;
  /** Renderiza solo esta escena (id/nombre o índice desde 0; ver `listScenes`). No se combina con `frames`. */
  scene?: string;
  /** Project root (default: parent of render/). */
  root?: string;
  cacheDir?: string;
  log?: (msg: string) => void;
};

export type RenderResult = { out: string; frames: number; seconds: number; renderedSegments: number; cachedSegments: number };
export type CheckResult = { ok: boolean; frames: number[]; determinism: { frame: number; ok: boolean; reordered?: boolean }[]; mismatches: number[]; diffs: Record<number, string> };

/** `--allow-missing-fonts` o `VE_ALLOW_MISSING_FONTS=1`: una fuente que no carga avisa y sigue en vez de fallar. */
export const allowMissingFonts = (o: { allowMissingFonts?: boolean }): boolean => o.allowMissingFonts ?? /^(1|true|si|sí|yes)$/i.test(process.env.VE_ALLOW_MISSING_FONTS ?? '');

export const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const defaultConcurrency = () => Math.max(1, Math.min(cpus().length, 6));
export const newRunId = () => `${process.pid}-${randomBytes(3).toString('hex')}`;

// ---------- helpers ----------

export function run(cmd: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd });
    trackChild(p);
    let err = '';
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => rej(new Error(`No se pudo ejecutar ${cmd}: ${e.message}${cmd === 'ffmpeg' ? ' (esta ffmpeg instalado y en el PATH?)' : ''}`)));
    p.on('close', (code) =>
      code === 0 ? res(out) : rej(new Error(`${cmd} fallo (codigo ${code}):\n${err.trim().split('\n').slice(-12).join('\n')}`)),
    );
  });
}

const walk = (dir: string, acc: string[] = [], skip: (name: string, depth: number) => boolean = () => false, depth = 0): string[] => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (skip(e.name, depth)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc, skip, depth + 1);
    else if (e.isFile()) acc.push(p);
  }
  return acc;
};

const hashFiles = async (base: string, files: string[], cache: FileHashCache = new FileHashCache()): Promise<string> => {
  const h = createHash('sha256');
  for (const f of [...files].sort()) h.update(relative(base, f)).update('\0').update(await cache.hashOf(f)).update('\0');
  return h.digest('hex');
};

/** Content hash of every file of a directory (the built bundle). */
export const hashDir = (dir: string, cache?: FileHashCache) => hashFiles(dir, walk(dir), cache);

/** path+size+mtime digest of extra asset directories. */
export function assetsDigest(dirs: string[]): string {
  const entries = dirs.flatMap((d) =>
    existsSync(d) ? walk(d).map((f) => ({ path: `${d}::${relative(d, f)}`, size: statSync(f).size, mtimeMs: statSync(f).mtimeMs })) : [],
  );
  return digestFiles(entries);
}

// eslint-disable-next-line no-control-regex
const stripAnsi = (t: string) => t.replace(/\u001b\[[0-9;]*m/g, '');

/** Carpeta que hace de `videos/` (VE_VIDEOS_DIR, para pruebas); `null` = el `videos/` real del proyecto. */
export const videosDirFromEnv = (): string | null => (process.env.VE_VIDEOS_DIR ? resolve(process.env.VE_VIDEOS_DIR) : null);

// vite.config.ts lee VE_VIDEOS_DIR al cargarse: dos compilaciones en el mismo proceso con carpetas distintas se serializan.
let buildChain: Promise<unknown> = Promise.resolve();

/**
 * Build the runtime bundle with vite into a content-addressed directory under the cache
 * (`bundles/<hash of all project inputs>`). It is never modified once built, so concurrent runs
 * (or `npm run build` writing dist/) cannot corrupt a render in progress, and no lock is needed.
 *
 * Con `videosDir` (o VE_VIDEOS_DIR) los videos salen de esa carpeta y el `videos/` real del proyecto NI SE COMPILA NI
 * entra en el hash: un video a medio hacer no contamina las pruebas.
 *
 * Si la compilación falla por un archivo de un video (sintaxis, import que no existe), no se pierden los demás: ese
 * archivo se reemplaza por un módulo que lanza el error al cargarse y se compila de nuevo. El runtime lo informa por
 * carpeta (`__ve.loadErrors`) y solo falla para ese video.
 */
export async function ensureBundle(root: string, cacheDir: string, runId: string, log: (m: string) => void, opts: { videosDir?: string | null } = {}): Promise<string> {
  const videosDir = opts.videosDir === undefined ? videosDirFromEnv() : opts.videosDir ? resolve(opts.videosDir) : null;
  if (videosDir && !(existsSync(videosDir) && statSync(videosDir).isDirectory())) {
    throw new Error(`VE_VIDEOS_DIR apunta a "${videosDir}", que no existe o no es una carpeta. Pasá la ruta de la carpeta que contiene los videos (<carpeta>/<slug>/index.ts) o quitá la variable.`);
  }
  const skipTop = new Set(['node_modules', 'dist', 'out', 'render', 'docs']);
  const skipExt = new Set(['out', 'node_modules']); // salidas por defecto de la carpeta externa: no son código del video
  if (videosDir) skipTop.add('videos');
  const files = walk(root, [], (name, depth) => name.startsWith('.') || (depth === 0 && skipTop.has(name)) || name.endsWith('.md'));
  const ext = videosDir && existsSync(videosDir) ? walk(videosDir, [], (name, depth) => name.startsWith('.') || name.endsWith('.md') || (depth === 0 && skipExt.has(name))) : [];
  const cache = new FileHashCache(join(cacheDir, 'filehash.json'));
  const h = createHash('sha256').update(await hashFiles(root, files, cache));
  if (videosDir) h.update('videos-dir\0').update(await hashFiles(videosDir, ext, cache));
  cache.save();
  const key = h.digest('hex').slice(0, 16); // includes package-lock.json, tsconfig.json, vite config
  const dir = join(cacheDir, 'bundles', key);
  if (existsSync(join(dir, 'index.html'))) {
    log(`bundle: ${key} en cache, se reutiliza`);
    return dir;
  }
  log('bundle: compilando con vite...');
  const tmp = join(cacheDir, 'bundles', `.tmp-${runId}`);
  trackPath(tmp);
  const build = async () => {
    const vite = await import('vite');
    const saved = process.env.VE_VIDEOS_DIR;
    if (videosDir) process.env.VE_VIDEOS_DIR = videosDir;
    else delete process.env.VE_VIDEOS_DIR;
    try {
      const stubbed = new Map<string, string>(); // archivo -> error de compilación
      const stub = {
        name: 've-stub-broken',
        enforce: 'pre' as const,
        load: (id: string) => {
          const msg = stubbed.get(id.split('?')[0]!);
          return msg === undefined ? null : `throw new Error(${JSON.stringify(msg)});`;
        },
      };
      for (let attempt = 0; ; attempt++) {
        try {
          await vite.build({ configFile: join(root, 'vite.config.ts'), logLevel: 'silent', plugins: [stub], build: { outDir: tmp, emptyOutDir: true } });
          return;
        } catch (e) {
          // rolldown agrupa los errores en `errors`; cada uno trae el archivo (`id`) donde se produjo
          type BuildErr = { id?: string; loc?: { file?: string }; file?: string; message?: string };
          const top = e as BuildErr & { errors?: BuildErr[] };
          const list = top.errors?.length ? top.errors : [top];
          const inVideo = (abs: string) => abs.startsWith(resolve(root, 'videos') + '/') || abs.startsWith(resolve(root, 'examples') + '/') || (videosDir !== null && abs.startsWith(videosDir + '/'));
          const mine = list
            // los errores de transformación (sintaxis) no traen `id`: el archivo va en el texto, como `[ ruta:linea:col ]`
            .map((x) => ({ x, bad: x.id ?? x.loc?.file ?? x.file ?? /\[\s*(\S+?\.[cm]?[jt]sx?)(?::\d+){0,2}\s*\]/.exec(stripAnsi(String(x.message)))?.[1] }))
            .filter((r): r is { x: BuildErr; bad: string } => !!r.bad)
            .map((r) => ({ ...r, abs: resolve(root, r.bad.split('?')[0]!) }))
            .filter((r) => inVideo(r.abs) && !stubbed.has(r.abs) && existsSync(r.abs));
          if (!mine.length || mine.length < list.length || attempt >= 8) throw e; // algo que no es de un video: es un error de verdad
          for (const { x, abs } of mine) {
            const where = videosDir && abs.startsWith(videosDir + '/') ? `videos/${relative(videosDir, abs)}` : relative(root, abs);
            const first = stripAnsi(String(x.message)).split('\n').filter(Boolean).slice(0, 2).join(' | ');
            log(`bundle: "${where}" no compila (${first}); se compila el resto sin ese archivo`);
            stubbed.set(abs, `${where} no compila: ${first}`);
          }
        }
      }
    } finally {
      if (saved === undefined) delete process.env.VE_VIDEOS_DIR;
      else process.env.VE_VIDEOS_DIR = saved;
    }
  };
  try {
    const run = buildChain.then(build, build);
    buildChain = run.catch(() => {});
    await run;
    try {
      renameSync(tmp, dir);
    } catch (e) {
      if (!existsSync(join(dir, 'index.html'))) throw e; // another run built the same bundle first
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    untrackPath(tmp);
  }
  return dir;
}

/**
 * Huella del código que puede cambiar los cuadros de UN video: los fuentes que usa el runtime y la carpeta del video
 * (`ve-deps.json`, que arma vite.config.ts siguiendo imports estáticos y dinámicos, `import.meta.glob` y los
 * `new URL('...', import.meta.url)` con literal, estén donde estén), todos los archivos de la carpeta del video,
 * `public/` entero y la configuración de compilación. Un cambio en otro video no la toca.
 * Devuelve `null` (se usa el hash de todo el bundle) si falta `ve-deps.json`, si la carpeta no figura o si el video (o el
 * runtime) usa algo que no se puede seguir (`new URL(variable, import.meta.url)`, `import(variable)`): ante la duda, todo.
 * El contenido se hashea con una cache por tamaño+mtime+ctime+inodo (ver render/filehash.ts), así que no se relee `public/`.
 */
export async function videoCodeHash(root: string, bundleDir: string, source: string | null | undefined, opts: { videosDir?: string | null; cache?: FileHashCache } = {}): Promise<string | null> {
  if (!source) return null;
  let deps: { runtime: string[]; videos: Record<string, string[]>; opaque?: string[] };
  try {
    deps = JSON.parse(readFileSync(join(bundleDir, 've-deps.json'), 'utf8'));
  } catch {
    return null;
  }
  const own = deps.videos[source];
  if (!own || deps.opaque?.includes(source)) return null;
  const videosDir = opts.videosDir === undefined ? videosDirFromEnv() : opts.videosDir;
  const at = (f: string) => (videosDir && (f === 'videos' || f.startsWith('videos/')) ? join(videosDir, f.slice('videos/'.length)) : join(root, f));
  const files = new Set<string>();
  for (const f of [...deps.runtime, ...own, 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'engine/runtime/index.html']) files.add(at(f));
  for (const dir of [at(source), join(root, 'public')]) if (existsSync(dir)) for (const f of statSync(dir).isDirectory() ? walk(dir) : [dir]) files.add(f);
  const present = [...files].filter((f) => existsSync(f) && statSync(f).isFile());
  const h = createHash('sha256');
  const cache = opts.cache ?? new FileHashCache();
  for (const f of present.sort()) h.update(relative(root, f)).update('\0').update(await cache.hashOf(f)).update('\0');
  return h.digest('hex').slice(0, 32);
}

type Shared = { error: Error | null };

async function openPage(browser: PwBrowser, ctxOpts: { width: number; height: number; scale: number }, url: string, shared: Shared) {
  const context = await browser.newContext({ viewport: { width: ctxOpts.width, height: ctxOpts.height }, deviceScaleFactor: ctxOpts.scale });
  const page = await context.newPage();
  const fail = (e: Error) => {
    shared.error ??= e;
  };
  page.on('pageerror', (e: Error) => fail(new Error(`Error en la pagina: ${e.message}`)));
  page.on('crash', () => fail(new Error('La pagina de Chromium se cerro inesperadamente (crash)')));
  await page.goto(url, { waitUntil: 'load' });
  return { page, context, cdp: await context.newCDPSession(page) };
}

const callReady = (page: PwPage) => page.evaluate(() => (window as any).__ve.ready as Promise<unknown>).then(() => undefined);

/** Segundos acumulados (sumando todas las páginas en paralelo) de cada etapa de la captura: sirve para ver dónde se va el tiempo. */
export type CaptureTiming = { setFrame: number; screenshot: number; write: number };

type Env = {
  browser: PwBrowser;
  timing: CaptureTiming;
  baseUrl: string;
  pageUrl: string;
  meta: VideoMeta;
  scale: number;
  shot: { format: 'png' | 'jpeg'; quality: number };
};

/**
 * Capture `frames` (in the given order) split into `nShards` contiguous shards, one page each.
 * Any setFrame rejection, page error or onFrame failure aborts the whole run.
 */
async function captureFrames(
  env: Env,
  frames: number[],
  nShards: number,
  onFrame: (n: number, png: Buffer) => void | Promise<void>,
  progressLabel?: (done: number, total: number) => void,
): Promise<void> {
  const shards = planShards(frames.length, nShards);
  const shared: Shared = { error: null };
  let done = 0;
  const { width, height } = env.meta;
  await Promise.all(
    shards.map(async (sh) => {
      let ctx: { close(): Promise<void> } | undefined;
      try {
        const { page, context, cdp } = await openPage(env.browser, { width, height, scale: env.scale }, env.pageUrl, shared);
        ctx = context;
        await callReady(page);
        for (let i = sh.start; i < sh.end; i++) {
          if (shared.error) return;
          const n = frames[i]!;
          const t0 = performance.now();
          try {
            await page.evaluate((f: number) => (window as any).__ve.setFrame(f), n);
          } catch (e) {
            throw new Error(`setFrame(${n}) fallo: ${(e as Error).message}`);
          }
          if (shared.error) return;
          const t1 = performance.now();
          // CDP capture: optimizeForSpeed (fast zlib, same pixels) is ~40% faster than page.screenshot for PNG.
          const r = await cdp.send('Page.captureScreenshot', {
            format: env.shot.format,
            ...(env.shot.format === 'jpeg' ? { quality: env.shot.quality } : { optimizeForSpeed: true }),
            clip: { x: 0, y: 0, width, height, scale: env.scale },
          });
          const t2 = performance.now();
          await onFrame(n, Buffer.from(r.data as string, 'base64'));
          env.timing.setFrame += (t1 - t0) / 1000;
          env.timing.screenshot += (t2 - t1) / 1000;
          env.timing.write += (performance.now() - t2) / 1000;
          done++;
          progressLabel?.(done, frames.length);
        }
      } catch (e) {
        shared.error ??= e as Error;
      } finally {
        await ctx?.close().catch(() => {});
      }
    }),
  );
  if (shared.error) throw shared.error;
}

function makeProgress(log: (m: string) => void, label: string) {
  let lastPct = -1;
  const t0 = Date.now();
  return (done: number, total: number) => {
    const pct = Math.floor((done / total) * 20) * 5;
    if (pct > lastPct) {
      lastPct = pct;
      const s = (Date.now() - t0) / 1000;
      log(`${label}: ${pct}% (${done}/${total} cuadros, ${(done / Math.max(s, 0.001)).toFixed(1)} fps)`);
    }
  };
}

async function setup(o: RenderOptions, needAudio: boolean) {
  const log = o.log ?? (() => {});
  const root = o.root ?? defaultRoot;
  const scale = o.scale ?? 1;
  const props = o.props ?? {};
  const runId = newRunId();
  const cacheDir = resolve(o.cacheDir ?? cacheDirPorDefecto(root));
  mkdirSync(cacheDir, { recursive: true });
  const bundleDir = await ensureBundle(root, cacheDir, runId, log);
  const hashes = new FileHashCache(join(cacheDir, 'filehash.json'));
  // Carpetas estáticas: `--assets`/VE_ASSETS primero; las del propio video y `<VE_VIDEOS_DIR>/assets` se agregan en cuanto se sabe
  // de qué carpeta es el video (la lista se lee en cada pedido, así que alcanza con completarla). Ver render/assets.ts.
  const explicit = explicitAssetDirs(o.assets);
  let assets = assetDirsFor(root, explicit, undefined).filter((d) => explicit.includes(d));
  const roots = [...assets, bundleDir, join(root, 'public')];
  const server = await serveStatic(roots, bundleDir);
  const browser = await launchChromium().catch(async (e) => {
    await server.close();
    throw e;
  });
  const pageUrl = `${server.url}/${pageQuery(o.videoId, props, o.format, { allowMissingFonts: allowMissingFonts(o) })}`;
  const untrack = trackCloser(() => browser.close());
  const cleanup = async () => {
    untrack();
    await browser.close().catch(() => {});
    await server.close();
  };
  try {
    // Primero una página que solo registra los videos (no dibuja): da la carpeta de origen y con ella las carpetas de estáticos,
    // que tienen que estar antes de que la página del video pida su primera fuente o imagen.
    const probeShared: Shared = { error: null };
    const probe = await openPage(browser, { width: 320, height: 180, scale: 1 }, `${server.url}/${NOSTAGE_QUERY}`, probeShared);
    let metas: VideoMeta[];
    try {
      await callReady(probe.page).catch(() => undefined);
      metas = (await probe.page.evaluate(() => (window as any).__ve.videos)) as VideoMeta[];
    } finally {
      await probe.context.close().catch(() => {});
    }
    const found = metas.find((m) => m.id === o.videoId);
    if (found) {
      assets = assetDirsFor(root, explicit, found.source);
      roots.splice(0, roots.length - 2, ...assets);
      if (assets.length) log(`estáticos: ${assets.join(', ')}`);
    }
    // Dedicated page: metadata, determinism check and the single audio scan.
    const shared: Shared = { error: null };
    const { page, context } = await openPage(browser, { width: 320, height: 180, scale: 1 }, pageUrl, shared);
    try {
      await callReady(page).catch((e: Error) => {
        throw new Error(`La pagina del video no arranco: ${cleanPageError(e.message)}`);
      });
      if (shared.error) throw shared.error;
      if (!found) throw new Error(`Video desconocido "${o.videoId}". Disponibles: ${metas.map((m) => m.id).join(', ')}`);
      const meta = metaForFormat(found, o.format);
      const scenes = async (): Promise<SceneInfo[]> => (await page.evaluate(() => (window as any).__ve.scenes())) as SceneInfo[];
      let tracks: Track[] = [];
      if (needAudio) tracks = (await page.evaluate(() => (window as any).__ve.scanAudio())) as Track[];
      const ffmpegVersion = (await run('ffmpeg', ['-version'])).split('\n')[0]!;
      const shot = { format: o.frameFormat ?? 'png', quality: o.jpegQuality ?? 95 } as const;
      const env: Env = { browser, timing: { setFrame: 0, screenshot: 0, write: 0 }, baseUrl: server.url, pageUrl, meta, scale, shot };
      // Everything besides bundle/props/range/scale/crf that can change a segment's pixels.
      const keyEnv = {
        ffmpeg: ffmpegVersion,
        chromium: browser.version(),
        chromiumArgs: process.env.VE_CHROMIUM_ARGS ?? '',
        chromiumBin: process.env.VE_CHROMIUM ?? '',
        assets: assetsDigest(assets),
        fps: meta.fps,
        width: meta.width,
        height: meta.height,
        format: meta.format,
        encoder: ENCODER_SETTINGS,
        frameFormat: shot.format,
        jpegQuality: shot.format === 'jpeg' ? shot.quality : null,
      };
      // La clave de las partes usa la huella de ESTE video (no la de todo el bundle) cuando se puede calcular.
      // Solo si hace falta se hashea todo el bundle (con la cache de hashes, no se relee lo que no cambió).
      const codeHash = (await videoCodeHash(root, bundleDir, found.source, { cache: hashes })) ?? (await hashDir(bundleDir, hashes));
      hashes.save();
      const loadErrors = (await page.evaluate(() => (window as any).__ve.loadErrors)) as { message: string }[];
      for (const e of loadErrors) log(`aviso: ${e.message.split('\n')[0]} (no afecta a este video)`);
      return { env, tracks, bundleHash: codeHash, keyEnv, root, bundleDir, cacheDir, runId, assets, cleanup, page, context, log, props, scenes };
    } catch (e) {
      await context.close().catch(() => {});
      throw e;
    }
  } catch (e) {
    await cleanup();
    throw e;
  }
}

// ---------- render ----------

/**
 * Sufijo del archivo de salida por defecto: `-vertical`, `-<escena>`. Si el nombre de la escena tiene caracteres que se
 * reemplazan (`a b` y `a/b` darían los dos `a_b`), se agrega el índice de la escena (o, si todavía no se conoce, un hash
 * corto del nombre) para que escenas distintas no pisen el mismo archivo.
 */
export const suffixOf = (o: { format?: FormatName; scene?: string }, sceneIndex?: number) => {
  let scene = '';
  if (o.scene !== undefined) {
    const clean = o.scene.replace(/[^A-Za-z0-9_-]+/g, '_');
    scene = `-${clean}${clean === o.scene ? '' : `-${sceneIndex ?? createHash('sha1').update(o.scene).digest('hex').slice(0, 6)}`}`;
  }
  return `${o.format ? `-${o.format}` : ''}${scene}`;
};

export async function renderVideo(options: RenderOptions): Promise<RenderResult> {
  const t0 = Date.now();
  const scale = options.scale ?? 1;
  const crf = options.crf ?? 18;
  const segSize = options.segment ?? 150;
  const useCache = options.cache ?? true;
  const wantAudio = options.audio ?? true;
  const concurrency = options.concurrency ?? defaultConcurrency();
  const s = await setup(options, wantAudio);
  const { env, log } = s;
  const tmpDir = join(s.cacheDir, `tmp-${s.runId}`);
  let out = '';
  let outTmp = '';
  trackPath(tmpDir);
  try {
    const { meta } = env;
    let [first, last] = options.frames ?? [0, meta.durationInFrames - 1];
    let sceneIndex: number | undefined;
    if (options.scene !== undefined) {
      if (options.frames) throw new Error('--scene y --frames no se combinan: --scene ya fija el rango de cuadros');
      const sc = resolveScene(await s.scenes(), options.scene);
      [first, last] = sceneRange(sc);
      sceneIndex = sc.index;
      log(`escena "${sc.id}" (índice ${sc.index}): cuadros ${first}-${last}`);
    }
    out = resolve(options.out ?? salidaPorDefecto(`${options.videoId}${suffixOf(options, sceneIndex)}.mp4`));
    outTmp = `${out}.${s.runId}.tmp.mp4`;
    trackPath(outTmp);
    if (last > meta.durationInFrames - 1) throw new RangeError(`--frames ${first}-${last} excede el video (0-${meta.durationInFrames - 1})`);
    const total = last - first + 1;
    // Con --scale el tamaño de salida puede salir impar: ffmpeg agrega una fila/columna negra para que x264 lo acepte; se avisa.
    const sw = Math.round(meta.width * scale);
    const sh = Math.round(meta.height * scale);
    if (sw % 2 || sh % 2) log(`aviso: ${meta.width}x${meta.height} con --scale ${scale} da ${sw}x${sh} (lado impar); se agrega ${sw % 2 ? 'una columna' : ''}${sw % 2 && sh % 2 ? ' y ' : ''}${sh % 2 ? 'una fila' : ''} negra para que sea par. Elegí otra escala si no lo querés.`);
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(dirname(out), { recursive: true });

    // Resolve every audio file up front: fail fast, before spending minutes on frames.
    const roots = [...s.assets, s.bundleDir, join(s.root, 'public')];
    const graph = wantAudio
      ? buildAudioGraph(windowTracks(s.tracks, first, last), {
          fps: meta.fps,
          durationFrames: total,
          firstInputIndex: 1,
          resolve: (src) => resolveSrc(src, roots, existsSync, join),
        })
      : null;

    const segments = planSegments(first, last, segSize).map((seg) => ({
      ...seg,
      file: join(s.cacheDir, `seg-${segmentKey({ bundleHash: s.bundleHash, videoId: options.videoId, props: s.props, start: seg.start, end: seg.end, scale, crf, env: s.keyEnv })}.mp4`),
    }));
    const todo = segments.filter((seg) => !useCache || !existsSync(seg.file));
    const cachedSegments = segments.length - todo.length;
    log(`${meta.id}: ${meta.width}x${meta.height}@${meta.fps} ${total} cuadros, ${segments.length} partes (${cachedSegments} en cache, ${todo.length} por renderizar)`);

    if (todo.length) {
      const ext = env.shot.format === 'jpeg' ? 'jpg' : 'png';
      const framesRoot = options.keepFrames ? join(dirname(out), `${options.videoId}${suffixOf(options, sceneIndex)}-frames`) : join(tmpDir, 'frames');
      mkdirSync(framesRoot, { recursive: true });
      const list: number[] = todo.flatMap((seg) => Array.from({ length: seg.end - seg.start + 1 }, (_, i) => seg.start + i));
      const remaining = new Map(todo.map((seg) => [seg, seg.end - seg.start + 1]));
      let encodeChain: Promise<void> = Promise.resolve();
      let encodeError: Error | null = null;
      let encodeTime = 0;

      // Encode a segment as soon as all its frames exist, then drop them (bounded disk use).
      const encode = async (seg: (typeof todo)[number]) => {
        const t = Date.now();
        const tmp = join(tmpDir, `seg-${seg.start}.mp4`);
        const args = [
          '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
          '-framerate', String(meta.fps), '-start_number', String(seg.start),
          '-i', framePattern(ext), '-frames:v', String(seg.end - seg.start + 1),
          '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
          '-c:v', ENCODER_SETTINGS.codec, '-preset', ENCODER_SETTINGS.preset, '-crf', String(crf),
          '-pix_fmt', ENCODER_SETTINGS.pixFmt, '-bf', String(ENCODER_SETTINGS.bframes),
          '-r', String(meta.fps), '-an', tmp,
        ];
        await run('ffmpeg', args, framesRoot); // cwd = frames dir: the pattern is relative
        renameSync(tmp, seg.file);
        if (!options.keepFrames) {
          for (let n = seg.start; n <= seg.end; n++) rmSync(join(framesRoot, frameFile(n, ext)), { force: true });
        }
        encodeTime += (Date.now() - t) / 1000;
      };

      const tCap = Date.now();
      try {
        await captureFrames(
          env,
          list,
          concurrency,
          async (n, png) => {
            if (encodeError) throw encodeError;
            await writeFile(join(framesRoot, frameFile(n, ext)), png);
            const seg = todo.find((g) => n >= g.start && n <= g.end)!;
            const left = remaining.get(seg)! - 1;
            remaining.set(seg, left);
            if (left === 0) encodeChain = encodeChain.then(() => encode(seg)).catch((e) => void (encodeError ??= e as Error));
          },
          makeProgress(log, 'render'),
        );
      } finally {
        await encodeChain;
      }
      if (encodeError) throw encodeError;
      const tm = env.timing;
      log(`captura+codificacion: ${((Date.now() - tCap) / 1000).toFixed(1)} s (x264 acumulado ${encodeTime.toFixed(1)} s, solapado con la captura)`);
      log(`tiempo por etapa (suma de las ${Math.min(concurrency, list.length)} páginas): dibujar el cuadro ${tm.setFrame.toFixed(1)} s, captura de pantalla ${tm.screenshot.toFixed(1)} s, escritura del PNG ${tm.write.toFixed(1)} s`);
      if (!options.keepFrames) rmSync(framesRoot, { recursive: true, force: true });
    }

    // Concat (no re-encode) + audio mux.
    const listFile = join(tmpDir, 'concat.txt');
    writeFileSync(listFile, segments.map((g) => `file '${g.file.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'concat', '-safe', '0', '-i', listFile];
    if (graph) {
      for (const f of graph.inputs) args.push('-i', f);
      args.push('-filter_complex', graph.filterComplex, '-map', '0:v', '-map', graph.map, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k');
    } else {
      args.push('-map', '0:v', '-c:v', 'copy');
    }
    args.push('-movflags', '+faststart', outTmp);
    await run('ffmpeg', args);
    renameSync(outTmp, out);
    const seconds = (Date.now() - t0) / 1000;
    log(`listo: ${out} (${total} cuadros, ${seconds.toFixed(1)} s, ${todo.length} partes renderizadas, ${cachedSegments} en cache)`);
    return { out, frames: total, seconds, renderedSegments: todo.length, cachedSegments };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    if (outTmp) rmSync(outTmp, { force: true });
    untrackPath(tmpDir);
    if (outTmp) untrackPath(outTmp);
    await s.context.close().catch(() => {});
    await s.cleanup();
  }
}

// ---------- check ----------

/** Pista que se imprime en toda falla de `--check` (título de la sección de docs/reglas.md). */
export const CHECK_HINT = 'pista: seguí la receta "Qué hacer cuando --check falla" en docs/reglas.md (bisecar piezas, causas habituales y arreglos).';

/** Puntos a consultar en un bbox (centro y esquinas), en px del escenario (el bbox viene en px de la captura: se divide por la escala). */
export function bboxPoints(bbox: [number, number, number, number], scale: number, width: number, height: number): [string, number, number][] {
  const [x0, y0, x1, y1] = bbox.map((v) => v / scale) as [number, number, number, number];
  const clamp = (v: number, max: number) => Math.min(Math.max(Math.round(v), 0), max - 1);
  const cx = clamp((x0 + x1 + 1) / 2, width), cy = clamp((y0 + y1 + 1) / 2, height);
  const [lx, rx, ty, by] = [clamp(x0, width), clamp(x1, width), clamp(y0, height), clamp(y1, height)];
  return [['centro', cx, cy], ['arriba-izq', lx, ty], ['arriba-der', rx, ty], ['abajo-izq', lx, by], ['abajo-der', rx, by]];
}

/** Agrupa lo que devolvió `describeAt` por elemento: `{ elemento: [puntos donde aparece] }`, en orden de aparición. */
export function groupElements(points: [string, number, number][], found: string[][]): [string, string[]][] {
  const m = new Map<string, string[]>();
  points.forEach(([name], i) => {
    for (const d of found[i] ?? []) m.set(d, [...(m.get(d) ?? []), name]);
  });
  return [...m];
}

/**
 * Qué hay en el rectángulo donde difieren dos capturas del cuadro `frame`: elementos (etiqueta, texto corto, ruta DOM,
 * data-* / name) en el centro y las esquinas del bbox, y las escenas con nombre activas en ese cuadro.
 */
async function describeBBox(s: Awaited<ReturnType<typeof setup>>, frame: number, bbox: [number, number, number, number]): Promise<string[]> {
  const { width, height } = s.env.meta;
  const pts = bboxPoints(bbox, s.env.scale, width, height);
  const lines: string[] = [];
  const shared: Shared = { error: null };
  const { page, context } = await openPage(s.env.browser, { width, height, scale: 1 }, s.env.pageUrl, shared);
  try {
    await callReady(page);
    const found = (await page.evaluate(([n, p]: [number, [number, number][]]) => (window as any).__ve.describeAt(n, p), [frame, pts.map(([, x, y]) => [x, y] as [number, number])])) as string[][];
    const groups = groupElements(pts, found);
    if (!groups.length) lines.push('no se encontraron elementos en esos puntos (¿el bbox cae fuera del escenario o sobre un canvas?)');
    for (const [el, where] of groups.slice(0, 8)) lines.push(`${el}  (en ${where.join(', ')})`);
  } catch (e) {
    lines.push(`no se pudo consultar la página: ${(e as Error).message}`);
  } finally {
    await context.close().catch(() => {});
  }
  try {
    const active = (await s.scenes()).filter((sc) => frame >= sc.from && frame < sc.from + sc.durationInFrames).map((sc) => sc.id);
    if (active.length) lines.push(`escenas con nombre activas en el cuadro ${frame}: ${active.join(', ')}`);
  } catch {
    /* el video no tiene escenas con nombre */
  }
  return lines;
}

/** Determinism check: __ve.checkDeterminism plus two PNG renders in different shard layouts. */
export async function checkVideo(options: RenderOptions): Promise<CheckResult> {
  const s = await setup({ ...options, frameFormat: 'png' }, false);
  const { env, log } = s;
  try {
    const plan = await (async () => {
      const common = { count: options.checkCount, perScene: options.checkPerScene, all: options.checkAll };
      if (options.scene !== undefined) {
        const sc = resolveScene(await s.scenes(), options.scene);
        const [a, b] = sceneRange(sc);
        log(`escena "${sc.id}" (índice ${sc.index}): cuadros ${a}-${b}`);
        return planCheckFrames({ first: a, last: b, scenes: [sc], ...common });
      }
      if (options.frames) {
        const [a, b] = options.frames;
        if (b > env.meta.durationInFrames - 1) throw new RangeError(`--frames ${a}-${b} excede el video (0-${env.meta.durationInFrames - 1})`);
        return planCheckFrames({ first: a, last: b, explicitRange: true, ...common });
      }
      // Por escena solo si no se pidió todo ni el video es enorme de escenas: leer las escenas recorre todos los cuadros una vez (solo DOM).
      const scenes = options.checkAll ? [] : await s.scenes().catch(() => []);
      return planCheckFrames({ first: 0, last: env.meta.durationInFrames - 1, scenes, ...common });
    })();
    const frames = plan.frames;
    log(`check: ${plan.summary}`);
    log(`check: cuadros ${frames.length > 60 ? `${frames.slice(0, 60).join(', ')}, ... (${frames.length} en total)` : frames.join(', ')}`);
    const det = (await s.page.evaluate((f: number[]) => (window as any).__ve.checkDeterminism(f), frames)) as { frame: number; ok: boolean; reordered?: boolean; error?: string; diffs?: string[] }[];
    for (const d of det) if (d.error) log(`check: cuadro ${d.frame}: ${d.error}`);
    const bad = det.filter((d) => !d.ok).map((d) => d.frame);
    if (bad.length) {
      log(`check: checkDeterminism FALLA en cuadros ${bad.join(', ')} (el DOM del mismo cuadro sale distinto según qué se dibujó antes)`);
      for (const d of det.filter((x) => !x.ok && x.diffs?.length)) {
        log(`check:   cuadro ${d.frame}, elementos que cambian entre los dos renders:`);
        for (const line of d.diffs!) log(`check:     ${line}`);
      }
      log(`check: ${CHECK_HINT}`);
    } else log('check: checkDeterminism ok');
    // Nota discreta (no es un fallo): cuadros cuyo HTML solo difirió en el orden de atributos o de propiedades de style.
    const reordered = det.filter((d) => d.ok && d.reordered).length;
    if (reordered > 0) log(`check: nota: ${reordered} ${reordered === 1 ? 'cuadro difirió' : 'cuadros difirieron'} solo en el orden de atributos o estilos (no es un fallo)`);

    const tol: CheckTolerance = { maxDelta: options.checkMaxDelta ?? DEFAULT_TOLERANCE.maxDelta, maxRatio: options.checkMaxRatio ?? DEFAULT_TOLERANCE.maxRatio, strict: options.checkStrict ?? false };
    const mismatches: number[] = [];
    const diffs: Record<number, string> = {};
    let noisy = 0;
    // De a tandas (no se guardan en memoria todos los PNG: con --check-all pueden ser miles).
    const CHUNK = 48;
    for (let at = 0; at < frames.length; at += CHUNK) {
      const chunk = frames.slice(at, at + CHUNK);
      const layoutA = new Map<number, Buffer>();
      const layoutB = new Map<number, Buffer>();
      // Layout A: 2 shards in order; layout B: reversed order in 3 shards (different pages, different history).
      await captureFrames(env, chunk, 2, (n, png) => void layoutA.set(n, png));
      await captureFrames(env, [...chunk].reverse(), 3, (n, png) => void layoutB.set(n, png));
      for (const n of chunk) {
        const stats = comparePngs(layoutA.get(n)!, layoutB.get(n)!);
        if (stats.diffPixels === 0) continue;
        noisy++;
        const ok = withinTolerance(stats, tol) && !(tol.strict && !layoutA.get(n)!.equals(layoutB.get(n)!));
        diffs[n] = formatDiff(stats);
        log(`check: cuadro ${n} ${ok ? 'ruido tolerado' : 'DIFERENTE'}: ${diffs[n]}`);
        if (!ok) {
          mismatches.push(n);
          if (stats.bbox) {
            log(`check:   elementos en el bbox del cuadro ${n}:`);
            for (const line of await describeBBox(s, n, stats.bbox)) log(`check:     ${line}`);
          }
        }
      }
      if (frames.length > CHUNK) log(`check: ${Math.min(at + CHUNK, frames.length)}/${frames.length} cuadros comparados`);
    }
    const mode = tol.strict ? 'estricto (byte a byte)' : `tolerante (ningun pixel con delta > ${tol.maxDelta}, <= ${(tol.maxRatio * 100).toFixed(3)}% con delta 2..${tol.maxDelta}, <= ${(DEFAULT_TOLERANCE.maxNoiseRatio * 100).toFixed(0)}% con delta 1)`;
    if (mismatches.length) {
      log(`check: PNG distintos entre layouts en cuadros ${mismatches.join(', ')} [${mode}]`);
      log(`check: ${CHECK_HINT}`);
    }
    else log(`check: PNG equivalentes en ambos layouts [${mode}]${noisy ? `, ${noisy} cuadros con ruido tolerado` : ', todos identicos'}`);
    log(`check: ${frames.length} cuadros verificados`);
    return { ok: bad.length === 0 && mismatches.length === 0, frames, determinism: det, mismatches, diffs };
  } finally {
    await s.context.close().catch(() => {});
    await s.cleanup();
  }
}

// ---------- listados ----------

/** Escenas con nombre del video (declaradas o juntadas de `<Sequence name>`), en el formato indicado. */
export async function listScenes(options: RenderOptions): Promise<{ meta: VideoMeta; scenes: SceneInfo[] }> {
  const s = await setup({ ...options, frameFormat: 'png' }, false);
  try {
    return { meta: s.env.meta, scenes: await s.scenes() };
  } finally {
    await s.context.close().catch(() => {});
    await s.cleanup();
  }
}

export type LoadErrorInfo = { folder: string; folders: string[]; ids: string[]; message: string };

/** Videos que el runtime descubrió (`examples/*` y `videos/*`) y los errores por carpeta (rota, `id` repetido) de las que no cargaron. */
export async function discoverVideos(options: { root?: string; cacheDir?: string; log?: (m: string) => void } = {}): Promise<{ videos: VideoMeta[]; errors: LoadErrorInfo[] }> {
  const root = options.root ?? defaultRoot;
  const cacheDir = resolve(options.cacheDir ?? cacheDirPorDefecto(root));
  mkdirSync(cacheDir, { recursive: true });
  const bundleDir = await ensureBundle(root, cacheDir, newRunId(), options.log ?? (() => {}));
  const server = await serveStatic([...assetDirsFor(root, explicitAssetDirs()), bundleDir, join(root, 'public')], bundleDir);
  let browser: PwBrowser | undefined;
  try {
    browser = await launchChromium();
    const shared: Shared = { error: null };
    const { page, context } = await openPage(browser, { width: 320, height: 180, scale: 1 }, `${server.url}/${NOSTAGE_QUERY}`, shared);
    try {
      // `ready` puede rechazar si el primer video es uno de los rotos: acá solo importa la lista y los errores.
      await page.evaluate(() => (window as any).__ve.ready as Promise<unknown>).catch(() => undefined);
      const videos = (await page.evaluate(() => (window as any).__ve.videos)) as VideoMeta[];
      const errors = (await page.evaluate(() => (window as any).__ve.loadErrors)) as LoadErrorInfo[];
      return { videos, errors };
    } finally {
      await context.close().catch(() => {});
    }
  } finally {
    await browser?.close().catch(() => {});
    await server.close();
  }
}

/** Solo la lista de videos (ver `discoverVideos` para los errores por carpeta). */
export async function listVideos(options: { root?: string; cacheDir?: string; log?: (m: string) => void } = {}): Promise<VideoMeta[]> {
  return (await discoverVideos(options)).videos;
}
