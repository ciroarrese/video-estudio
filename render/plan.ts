import { createHash } from 'node:crypto';

/** Contiguous slice [start, end) over a list of items. */
export type Shard = { start: number; end: number };
/** Inclusive frame range. */
export type Segment = { start: number; end: number };

/** Split `total` items into at most `n` contiguous, balanced shards (earlier shards get the remainder). */
export function planShards(total: number, n: number): Shard[] {
  if (!Number.isInteger(total) || total < 0) throw new RangeError(`planShards: invalid total ${total}`);
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`planShards: invalid shard count ${n}`);
  if (total === 0) return [];
  const count = Math.min(n, total);
  const base = Math.floor(total / count);
  const extra = total % count;
  const shards: Shard[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    const len = base + (i < extra ? 1 : 0);
    shards.push({ start: at, end: at + len });
    at += len;
  }
  return shards;
}

/**
 * Split the inclusive frame range [first, last] into segments aligned to multiples of `size`
 * (so a partial render reuses the cache of a full one).
 */
export function planSegments(first: number, last: number, size: number): Segment[] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`planSegments: invalid segment size ${size}`);
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last < first) {
    throw new RangeError(`planSegments: invalid range ${first}-${last}`);
  }
  const out: Segment[] = [];
  for (let s = Math.floor(first / size) * size; s <= last; s += size) {
    out.push({ start: Math.max(s, first), end: Math.min(s + size - 1, last) });
  }
  return out;
}

/** JSON with sorted object keys, so equal values always serialize equally. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Encoder settings; part of the segment cache key and used to build the ffmpeg arguments. */
export const ENCODER_SETTINGS = { codec: 'libx264', preset: 'medium', bframes: 2, pixFmt: 'yuv420p' } as const;

export type SegmentKeyInput = {
  bundleHash: string;
  videoId: string;
  props: unknown;
  start: number;
  end: number;
  scale: number;
  crf: number;
  /** Everything else that changes pixels: tool versions, assets digest, fps/size, encoder, capture format... */
  env?: unknown;
};

export function segmentKey(i: SegmentKeyInput): string {
  return createHash('sha256').update(stableStringify(i)).digest('hex').slice(0, 20);
}

/** Digest of a file listing (path + size + mtime), independent of listing order. */
export function digestFiles(entries: { path: string; size: number; mtimeMs: number }[]): string {
  const h = createHash('sha256');
  for (const e of [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    h.update(`${e.path}\0${e.size}\0${Math.round(e.mtimeMs)}\n`);
  }
  return h.digest('hex');
}

/**
 * ffmpeg image2 input pattern. It is always RELATIVE (ffmpeg runs with cwd = frames dir), so a `%`
 * in the directory name can never be read as a printf directive.
 */
export const framePattern = (ext: string) => `%06d.${ext}`;
export const frameFile = (n: number, ext: string) => `${String(n).padStart(6, '0')}.${ext}`;

/** ~count evenly spaced, unique, sorted frames in [0, total-1]. */
export function evenFrames(total: number, count: number): number[] {
  if (total <= 0) return [];
  if (count <= 1 || total === 1) return [0];
  const set = new Set<number>();
  for (let i = 0; i < count; i++) set.add(Math.round((i * (total - 1)) / (count - 1)));
  return [...set].sort((a, b) => a - b);
}

/** Cuadros de una escena que `--check` mira siempre: unos pocos cerca del comienzo (ahí ocurren las entradas) y el resto repartido hasta el final. */
export const SCENE_ENTRY_OFFSETS = [2, 10, 24] as const;

/**
 * Hasta `n` cuadros de una escena (`from`, `duration`): los primeros son los de `SCENE_ENTRY_OFFSETS` (relativos al inicio de la
 * escena, los que caben) y el resto se reparte parejo hasta el último cuadro. Sin repetidos, ordenados.
 */
export function sceneCheckFrames(from: number, duration: number, n: number): number[] {
  if (duration <= 0 || n <= 0) return [];
  if (n >= duration) return Array.from({ length: duration }, (_, i) => from + i);
  const near = SCENE_ENTRY_OFFSETS.filter((o) => o < duration).slice(0, n);
  const set = new Set<number>(near);
  const rest = n - near.length;
  const lo = near.length ? near[near.length - 1]! : 0;
  for (let j = 1; j <= rest; j++) set.add(Math.min(duration - 1, Math.round(lo + ((duration - 1 - lo) * j) / rest)));
  return [...set].sort((a, b) => a - b).map((o) => from + o);
}

export type CheckPlanInput = {
  /** Rango inclusivo que se cubre: todo el video, una escena (`--scene`) o lo pedido con `--frames a-b`. */
  first: number;
  last: number;
  /** Con `--frames`: se muestrea solo dentro del rango (no se agregan cuadros por escena). */
  explicitRange?: boolean;
  /** Escenas con nombre del video (las que no tocan el rango se ignoran). */
  scenes?: { id: string; from: number; durationInFrames: number }[];
  /** Cuadros repartidos parejos en el rango (por defecto 12). */
  count?: number;
  /** Cuadros por escena (por defecto 6). */
  perScene?: number;
  /** Todos los cuadros del rango (lento). */
  all?: boolean;
};
export type CheckPlan = { frames: number[]; /** Resumen para imprimir: cuántos cuadros y de qué tipo. */ summary: string };

export const DEFAULT_CHECK_COUNT = 12;
export const DEFAULT_CHECK_PER_SCENE = 6;

/**
 * Qué cuadros verifica `--check`. Con `--check-all`, todos. Con `--frames a-b`, `count` repartidos dentro del rango (o todos si el
 * rango es corto). Sin eso: `count` repartidos en el rango más, por cada escena con nombre, `perScene` cuadros (varios cerca del inicio).
 */
export function planCheckFrames(i: CheckPlanInput): CheckPlan {
  const total = i.last - i.first + 1;
  const count = i.count ?? DEFAULT_CHECK_COUNT;
  const perScene = i.perScene ?? DEFAULT_CHECK_PER_SCENE;
  if (total <= 0) throw new RangeError(`planCheckFrames: rango vacío ${i.first}-${i.last}`);
  const even = evenFrames(total, count).map((n) => n + i.first);
  if (i.all) return { frames: Array.from({ length: total }, (_, k) => i.first + k), summary: `${total} cuadros (--check-all: todos los del rango ${i.first}-${i.last})` };
  if (i.explicitRange) {
    const frames = total <= count ? Array.from({ length: total }, (_, k) => i.first + k) : even;
    return { frames, summary: `${frames.length} cuadros dentro del rango pedido ${i.first}-${i.last} (--frames)` };
  }
  const set = new Set(even);
  let scenesUsed = 0;
  for (const s of i.scenes ?? []) {
    const from = Math.max(s.from, i.first);
    const to = Math.min(s.from + s.durationInFrames - 1, i.last);
    if (to < from) continue;
    scenesUsed++;
    // `from` es relativo al video, el recorte al rango puede mover el inicio: los desplazamientos de entrada se miden desde el inicio real
    for (const f of sceneCheckFrames(s.from, s.durationInFrames, perScene)) if (f >= from && f <= to) set.add(f);
  }
  const frames = [...set].sort((a, b) => a - b);
  const summary = scenesUsed
    ? `${frames.length} cuadros (${even.length} repartidos + hasta ${perScene} por escena en ${scenesUsed} ${scenesUsed === 1 ? 'escena' : 'escenas'}, varios cerca del inicio de cada una)`
    : `${frames.length} cuadros repartidos parejos (el video no declara escenas con nombre)`;
  return { frames, summary };
}
