import { useContext } from 'react';
import { TimeContext } from './context';

export type AudioTrack = {
  src: string;
  /** Absolute frame (whole video) where the track starts. Never negative. */
  from: number;
  /** Absolute frame where the enclosing Sequence/Series.Item ends (exclusive); Infinity if unbounded. */
  to: number;
  /** Frames to skip at the beginning of the source file. */
  startFrom: number;
  volume: number;
};

const tracks = new Map<string, AudioTrack>();

export function registerAudio(t: AudioTrack): void {
  tracks.set(`${t.src}|${t.from}|${t.to}|${t.startFrom}|${t.volume}`, t);
}

export function collectAudio(): AudioTrack[] {
  return [...tracks.values()].sort((a, b) => a.from - b.from);
}

export function clearAudio(): void {
  tracks.clear();
}

/**
 * Renders nothing. Registers a track for the renderer to mix with ffmpeg.
 * Registration happens during render (idempotent, keyed by value) so it does not
 * depend on effects re-running. A negative absolute start is clamped to 0 and
 * the skipped frames are added to startFrom.
 */
export function Audio({ src, startFrom = 0, volume = 1 }: { src: string; startFrom?: number; volume?: number }) {
  const t = useContext(TimeContext);
  if (!t) throw new Error('<Audio> must be used inside <FrameProvider>');
  if (!Number.isFinite(startFrom) || startFrom < 0) {
    throw new Error(`<Audio src="${src}">: startFrom must be a non-negative number (got ${startFrom})`);
  }
  let from = t.offset;
  let skip = startFrom;
  if (from < 0) {
    skip += -from;
    from = 0;
  }
  registerAudio({ src, from, to: t.end, startFrom: skip, volume });
  return null;
}
