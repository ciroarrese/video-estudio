import { isAbsolute } from 'node:path';

/** Track as reported by `__ve.scanAudio()` (`to: null` = until the end of the video). */
export type Track = { src: string; from: number; to: number | null; startFrom: number; volume: number };

export type AudioGraph = {
  /** Input files, in order; ffmpeg input index = firstInputIndex + position. */
  inputs: string[];
  filterComplex: string;
  /** Label to `-map`. */
  map: string;
};

const SAMPLE_RATE = 48000;
const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);

/**
 * Re-base tracks to a frame window [first, last] (inclusive): the output starts at `first`.
 * Tracks entirely outside the window are dropped.
 */
export function windowTracks(tracks: Track[], first: number, last: number): Track[] {
  const out: Track[] = [];
  const end = last + 1;
  for (const t of tracks) {
    const to = t.to === null ? null : Math.min(t.to, end) - first;
    if ((t.to ?? Infinity) <= first || t.from >= end) continue;
    let from = t.from - first;
    let startFrom = t.startFrom;
    if (from < 0) {
      startFrom += -from;
      from = 0;
    }
    out.push({ ...t, from, to: to === null ? null : to, startFrom });
  }
  return out;
}

/**
 * Pure: tracks -> ffmpeg inputs + filter_complex. Each track is trimmed (skip `startFrom`, cut at `to`),
 * scaled by `volume`, delayed to `from`, converted to a common format, mixed (no normalization)
 * and padded/trimmed to exactly the video duration. Returns null when there is nothing to play.
 */
export function buildAudioGraph(
  tracks: Track[],
  opts: { fps: number; durationFrames: number; resolve: (src: string) => string; firstInputIndex?: number },
): AudioGraph | null {
  const { fps, durationFrames, resolve } = opts;
  const base = opts.firstInputIndex ?? 0;
  const duration = durationFrames / fps;
  const inputs: string[] = [];
  const chains: string[] = [];
  const labels: string[] = [];
  for (const t of tracks) {
    if (t.from >= durationFrames) continue;
    const toFrame = Math.min(t.to ?? durationFrames, durationFrames);
    const playFrames = toFrame - t.from;
    if (playFrames <= 0) continue;
    const idx = base + inputs.length;
    inputs.push(resolve(t.src));
    const label = `a${inputs.length - 1}`;
    const start = t.startFrom / fps;
    const end = start + playFrames / fps;
    const delayMs = Math.round((t.from / fps) * 1000);
    chains.push(
      `[${idx}:a]atrim=start=${fmt(start)}:end=${fmt(end)},asetpts=PTS-STARTPTS,` +
        `aformat=sample_fmts=fltp:sample_rates=${SAMPLE_RATE}:channel_layouts=stereo,` +
        `volume=${fmt(t.volume)},adelay=${delayMs}:all=1[${label}]`,
    );
    labels.push(`[${label}]`);
  }
  if (labels.length === 0) return null;
  const mix =
    `${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,` +
    `apad=whole_dur=${fmt(duration)},atrim=end=${fmt(duration)},asetpts=PTS-STARTPTS[aout]`;
  return { inputs, filterComplex: [...chains, mix].join(';'), map: '[aout]' };
}

/** Resolve a track `src` against a list of root directories (first match wins). */
export function resolveSrc(src: string, roots: string[], exists: (p: string) => boolean, join: (...p: string[]) => string, base = '/'): string {
  if (/^[a-z]+:\/\//i.test(src)) throw new Error(`Audio src "${src}" is a remote URL; only local files are supported`);
  if (isAbsolute(src) && exists(src)) return src;
  let rel = src.split(/[?#]/)[0]!;
  if (base !== '/' && rel.startsWith(base)) rel = rel.slice(base.length);
  rel = rel.replace(/^\/+/, '');
  for (const r of roots) {
    const p = join(r, rel);
    if (exists(p)) return p;
  }
  throw new Error(`Audio file "${src}" not found. Looked in: ${roots.join(', ')}`);
}
