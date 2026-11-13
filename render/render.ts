import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { cpus } from 'node:os';
import { createReadStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparePngs, DEFAULT_TOLERANCE, formatDiff, withinTolerance, type CheckTolerance } from './compare';
import { buildAudioGraph, resolveSrc, windowTracks, type Track } from './audio';
import { launchChromium, type PwBrowser, type PwPage } from './browser';
import { trackChild, trackCloser, trackPath, untrackPath } from './cleanup';
import { digestFiles, ENCODER_SETTINGS, evenFrames, frameFile, framePattern, planSegments, planShards, segmentKey } from './plan';
import { serveStatic } from './server';

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
  /** Project root (default: parent of render/). */
  root?: string;
  cacheDir?: string;
  log?: (msg: string) => void;
};

export type RenderResult = { out: string; frames: number; seconds: number; renderedSegments: number; cachedSegments: number };
export type CheckResult = { ok: boolean; frames: number[]; determinism: { frame: number; ok: boolean }[]; mismatches: number[]; diffs: Record<number, string> };

type VideoMeta = { id: string; fps: number; width: number; height: number; durationInFrames: number };

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

const hashFiles = async (base: string, files: string[]): Promise<string> => {
  const h = createHash('sha256');
  for (const f of files.sort()) {
    h.update(relative(base, f)).update('\0');
    await new Promise<void>((res, rej) => createReadStream(f).on('data', (d) => h.update(d)).on('end', res).on('error', rej));
    h.update('\0');
  }
  return h.digest('hex');
};

/** Content hash of every file of a directory (the built bundle). */
export const hashDir = (dir: string) => hashFiles(dir, walk(dir));

/** path+size+mtime digest of extra asset directories. */
export function assetsDigest(dirs: string[]): string {
  const entries = dirs.flatMap((d) =>
    existsSync(d) ? walk(d).map((f) => ({ path: `${d}::${relative(d, f)}`, size: statSync(f).size, mtimeMs: statSync(f).mtimeMs })) : [],
  );
  return digestFiles(entries);
}

/**
 * Build the runtime bundle with vite into a content-addressed directory under the cache
 * (`bundles/<hash of all project inputs>`). It is never modified once built, so concurrent runs
 * (or `npm run build` writing dist/) cannot corrupt a render in progress, and no lock is needed.
 */
export async function ensureBundle(root: string, cacheDir: string, runId: string, log: (m: string) => void): Promise<string> {
  const skipTop = new Set(['node_modules', 'dist', 'out', 'render', 'docs']);
  const files = walk(root, [], (name, depth) => name.startsWith('.') || (depth === 0 && skipTop.has(name)) || name.endsWith('.md'));
  const key = (await hashFiles(root, files)).slice(0, 16); // includes package-lock.json, tsconfig.json, vite config
  const dir = join(cacheDir, 'bundles', key);
  if (existsSync(join(dir, 'index.html'))) {
    log(`bundle: ${key} en cache, se reutiliza`);
    return dir;
  }
  log('bundle: compilando con vite...');
  const tmp = join(cacheDir, 'bundles', `.tmp-${runId}`);
  trackPath(tmp);
  try {
    const vite = await import('vite');
    await vite.build({ configFile: join(root, 'vite.config.ts'), logLevel: 'warn', build: { outDir: tmp, emptyOutDir: true } });
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
  const bundleHash = await hashDir(bundleDir);
  const assets = (o.assets ?? []).map((a) => resolve(a));
  const server = await serveStatic([...assets, bundleDir, join(root, 'public')], bundleDir);
  const browser = await launchChromium().catch(async (e) => {
    await server.close();
    throw e;
  });
  const pageUrl = `${server.url}/?video=${encodeURIComponent(o.videoId)}${Object.keys(props).length ? `&props=${encodeURIComponent(JSON.stringify(props))}` : ''}`;
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
      const meta = metas.find((m) => m.id === o.videoId);
      if (!meta) throw new Error(`Video desconocido "${o.videoId}". Disponibles: ${metas.map((m) => m.id).join(', ')}`);
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
        encoder: ENCODER_SETTINGS,
        frameFormat: shot.format,
        jpegQuality: shot.format === 'jpeg' ? shot.quality : null,
      };
      return { env, tracks, bundleHash, keyEnv, root, bundleDir, cacheDir, runId, assets, cleanup, page, context, log, props };
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
  const out = resolve(options.out ?? join('out', `${options.videoId}.mp4`));
  const outTmp = `${out}.${s.runId}.tmp.mp4`;
  trackPath(tmpDir);
  trackPath(outTmp);
  try {
    const { meta } = env;
    const [first, last] = options.frames ?? [0, meta.durationInFrames - 1];
    if (last > meta.durationInFrames - 1) throw new RangeError(`--frames ${first}-${last} excede el video (0-${meta.durationInFrames - 1})`);
    const total = last - first + 1;
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
      const framesRoot = options.keepFrames ? join(dirname(out), `${options.videoId}-frames`) : join(tmpDir, 'frames');
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
    rmSync(outTmp, { force: true });
    untrackPath(tmpDir);
    untrackPath(outTmp);
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
    const total = env.meta.durationInFrames;
    const frames = evenFrames(total, 12);
    log(`check: cuadros ${frames.join(', ')}`);
    const det = (await s.page.evaluate((f: number[]) => (window as any).__ve.checkDeterminism(f), frames)) as { frame: number; ok: boolean }[];
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
    const mode = tol.strict ? 'estricto (byte a byte)' : `tolerante (delta <= ${tol.maxDelta}, <= ${(tol.maxRatio * 100).toFixed(3)}% de pixeles)`;
    if (mismatches.length) log(`check: PNG distintos entre layouts en cuadros ${mismatches.join(', ')} [${mode}]`);
    else log(`check: PNG equivalentes en ambos layouts [${mode}]${noisy ? `, ${noisy} cuadros con ruido tolerado` : ', todos identicos'}`);
    return { ok: bad.length === 0 && mismatches.length === 0, frames, determinism: det, mismatches, diffs };
  } finally {
    await s.context.close().catch(() => {});
    await s.cleanup();
  }
}
