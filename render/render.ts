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
import { digestFiles, ENCODER_SETTINGS, evenFrames, frameFile, framePattern, planSegments, planShards, segmentKey } from './plan';
import { serveStatic } from './server';
import { metaForFormat, pageQuery, resolveScene, sceneRange, type VideoMeta } from './meta';
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
  /** Extra static / audio directories (searched first). */
  assets?: string[];
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
export type CheckResult = { ok: boolean; frames: number[]; determinism: { frame: number; ok: boolean }[]; mismatches: number[]; diffs: Record<number, string> };

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
  const skipTop = new Set(['node_modules', 'dist', 'out', 'render', 'docs']);
  if (videosDir) skipTop.add('videos');
  const files = walk(root, [], (name, depth) => name.startsWith('.') || (depth === 0 && skipTop.has(name)) || name.endsWith('.md'));
  const ext = videosDir && existsSync(videosDir) ? walk(videosDir, [], (name) => name.startsWith('.') || name.endsWith('.md')) : [];
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
          const err = e as Error & { id?: string; loc?: { file?: string }; file?: string };
          const bad = err.id ?? err.loc?.file ?? err.file;
          const abs = bad ? resolve(bad.split('?')[0]!) : null;
          const inVideo = abs !== null && (abs.startsWith(resolve(root, 'videos') + '/') || abs.startsWith(resolve(root, 'examples') + '/') || (videosDir !== null && abs.startsWith(videosDir + '/')));
          if (!inVideo || stubbed.has(abs!) || attempt >= 8 || !existsSync(abs!)) throw e;
          const where = videosDir && abs!.startsWith(videosDir + '/') ? `videos/${relative(videosDir, abs!)}` : relative(root, abs!);
          const first = String(err.message).split('\n').filter(Boolean).slice(0, 3).join(' | ');
          log(`bundle: "${where}" no compila (${first}); se compila el resto sin ese archivo`);
          stubbed.set(abs!, `${where} no compila: ${first}`);
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

type Env = {
  browser: PwBrowser;
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
          try {
            await page.evaluate((f: number) => (window as any).__ve.setFrame(f), n);
          } catch (e) {
            throw new Error(`setFrame(${n}) fallo: ${(e as Error).message}`);
          }
          if (shared.error) return;
          // CDP capture: optimizeForSpeed (fast zlib, same pixels) is ~40% faster than page.screenshot for PNG.
          const r = await cdp.send('Page.captureScreenshot', {
            format: env.shot.format,
            ...(env.shot.format === 'jpeg' ? { quality: env.shot.quality } : { optimizeForSpeed: true }),
            clip: { x: 0, y: 0, width, height, scale: env.scale },
          });
          await onFrame(n, Buffer.from(r.data as string, 'base64'));
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
  const cacheDir = resolve(o.cacheDir ?? join(root, '.ve-cache'));
  mkdirSync(cacheDir, { recursive: true });
  const bundleDir = await ensureBundle(root, cacheDir, runId, log);
  const hashes = new FileHashCache(join(cacheDir, 'filehash.json'));
  const assets = (o.assets ?? []).map((a) => resolve(a));
  const server = await serveStatic([...assets, bundleDir, join(root, 'public')], bundleDir);
  const browser = await launchChromium().catch(async (e) => {
    await server.close();
    throw e;
  });
  const pageUrl = `${server.url}/${pageQuery(o.videoId, props, o.format)}`;
  const untrack = trackCloser(() => browser.close());
  const cleanup = async () => {
    untrack();
    await browser.close().catch(() => {});
    await server.close();
  };
  // Dedicated page: metadata, determinism check and the single audio scan.
  try {
    const shared: Shared = { error: null };
    const { page, context } = await openPage(browser, { width: 320, height: 180, scale: 1 }, pageUrl, shared);
    try {
      await callReady(page).catch((e: Error) => {
        throw new Error(`La pagina del video no arranco: ${e.message}`);
      });
      if (shared.error) throw shared.error;
      const metas = (await page.evaluate(() => (window as any).__ve.videos)) as VideoMeta[];
      const found = metas.find((m) => m.id === o.videoId);
      if (!found) throw new Error(`Video desconocido "${o.videoId}". Disponibles: ${metas.map((m) => m.id).join(', ')}`);
      const meta = metaForFormat(found, o.format);
      const scenes = async (): Promise<SceneInfo[]> => (await page.evaluate(() => (window as any).__ve.scenes())) as SceneInfo[];
      let tracks: Track[] = [];
      if (needAudio) tracks = (await page.evaluate(() => (window as any).__ve.scanAudio())) as Track[];
      const ffmpegVersion = (await run('ffmpeg', ['-version'])).split('\n')[0]!;
      const shot = { format: o.frameFormat ?? 'png', quality: o.jpegQuality ?? 95 } as const;
      const env: Env = { browser, baseUrl: server.url, pageUrl, meta, scale, shot };
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
    out = resolve(options.out ?? join('out', `${options.videoId}${suffixOf(options, sceneIndex)}.mp4`));
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
      log(`captura+codificacion: ${((Date.now() - tCap) / 1000).toFixed(1)} s (x264 acumulado ${encodeTime.toFixed(1)} s, solapado con la captura)`);
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

/** Determinism check: __ve.checkDeterminism plus two PNG renders in different shard layouts. */
export async function checkVideo(options: RenderOptions): Promise<CheckResult> {
  const s = await setup({ ...options, frameFormat: 'png' }, false);
  const { env, log } = s;
  try {
    let total = env.meta.durationInFrames;
    let offset = 0;
    if (options.scene !== undefined) {
      const sc = resolveScene(await s.scenes(), options.scene);
      total = sc.durationInFrames;
      offset = sc.from;
      log(`escena "${sc.id}" (índice ${sc.index}): cuadros ${sc.from}-${sc.from + total - 1}`);
    }
    const frames = evenFrames(total, 12).map((n) => n + offset);
    log(`check: cuadros ${frames.join(', ')}`);
    const det = (await s.page.evaluate((f: number[]) => (window as any).__ve.checkDeterminism(f), frames)) as { frame: number; ok: boolean; error?: string }[];
    for (const d of det) if (d.error) log(`check: cuadro ${d.frame}: ${d.error}`);
    const bad = det.filter((d) => !d.ok).map((d) => d.frame);
    if (bad.length) log(`check: checkDeterminism FALLA en cuadros ${bad.join(', ')}`);
    else log('check: checkDeterminism ok');

    const layoutA = new Map<number, Buffer>();
    const layoutB = new Map<number, Buffer>();
    // Layout A: 2 shards in order; layout B: reversed order in 3 shards (different pages, different history).
    await captureFrames(env, frames, 2, (n, png) => void layoutA.set(n, png));
    await captureFrames(env, [...frames].reverse(), 3, (n, png) => void layoutB.set(n, png));
    const tol: CheckTolerance = { maxDelta: options.checkMaxDelta ?? DEFAULT_TOLERANCE.maxDelta, maxRatio: options.checkMaxRatio ?? DEFAULT_TOLERANCE.maxRatio, strict: options.checkStrict ?? false };
    const mismatches: number[] = [];
    const diffs: Record<number, string> = {};
    let noisy = 0;
    for (const n of frames) {
      const stats = comparePngs(layoutA.get(n)!, layoutB.get(n)!);
      if (stats.diffPixels === 0) continue;
      noisy++;
      const ok = withinTolerance(stats, tol) && !(tol.strict && !layoutA.get(n)!.equals(layoutB.get(n)!));
      diffs[n] = formatDiff(stats);
      log(`check: cuadro ${n} ${ok ? 'ruido tolerado' : 'DIFERENTE'}: ${diffs[n]}`);
      if (!ok) mismatches.push(n);
    }
    const mode = tol.strict ? 'estricto (byte a byte)' : `tolerante (ningun pixel con delta > ${tol.maxDelta}, <= ${(tol.maxRatio * 100).toFixed(3)}% con delta 2..${tol.maxDelta}, <= ${(DEFAULT_TOLERANCE.maxNoiseRatio * 100).toFixed(0)}% con delta 1)`;
    if (mismatches.length) log(`check: PNG distintos entre layouts en cuadros ${mismatches.join(', ')} [${mode}]`);
    else log(`check: PNG equivalentes en ambos layouts [${mode}]${noisy ? `, ${noisy} cuadros con ruido tolerado` : ', todos identicos'}`);
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

/** Videos que el runtime descubrió (`examples/*` y `videos/*`), con tamaños y formatos. */
export async function listVideos(options: { root?: string; cacheDir?: string; log?: (m: string) => void } = {}): Promise<VideoMeta[]> {
  const root = options.root ?? defaultRoot;
  const cacheDir = resolve(options.cacheDir ?? join(root, '.ve-cache'));
  mkdirSync(cacheDir, { recursive: true });
  const bundleDir = await ensureBundle(root, cacheDir, newRunId(), options.log ?? (() => {}));
  const server = await serveStatic([bundleDir, join(root, 'public')], bundleDir);
  let browser: PwBrowser | undefined;
  try {
    browser = await launchChromium();
    const shared: Shared = { error: null };
    const { page, context } = await openPage(browser, { width: 320, height: 180, scale: 1 }, `${server.url}/`, shared);
    try {
      await page.evaluate(() => (window as any).__ve.ready as Promise<unknown>).catch(() => undefined);
      const err = (await page.evaluate(() => (window as any).__ve.loadError)) as string | null;
      if (err) throw new Error(err);
      return (await page.evaluate(() => (window as any).__ve.videos)) as VideoMeta[];
    } finally {
      await context.close().catch(() => {});
    }
  } finally {
    await browser?.close().catch(() => {});
    await server.close();
  }
}
