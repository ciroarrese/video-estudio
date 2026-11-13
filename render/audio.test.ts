import { describe, expect, it } from 'vitest';
import { buildAudioGraph, resolveSrc, windowTracks, type Track } from './audio';

const t = (o: Partial<Track>): Track => ({ src: 'a.wav', from: 0, to: null, startFrom: 0, volume: 1, ...o });
const resolve = (s: string) => `/pub/${s}`;

describe('buildAudioGraph', () => {
  it('returns null without playable tracks', () => {
    expect(buildAudioGraph([], { fps: 30, durationFrames: 90, resolve })).toBeNull();
    expect(buildAudioGraph([t({ from: 90 })], { fps: 30, durationFrames: 90, resolve })).toBeNull();
  });
  it('places, trims, scales volume and mixes', () => {
    const g = buildAudioGraph(
      [t({ src: 'root.wav', volume: 0.8 }), t({ src: 'n.wav', from: 30, to: 50, startFrom: 5 })],
      { fps: 30, durationFrames: 90, resolve, firstInputIndex: 1 },
    )!;
    expect(g.inputs).toEqual(['/pub/root.wav', '/pub/n.wav']);
    expect(g.map).toBe('[aout]');
    const parts = g.filterComplex.split(';');
    expect(parts[0]).toContain('[1:a]atrim=start=0:end=3');
    expect(parts[0]).toContain('volume=0.8');
    expect(parts[0]).toContain('adelay=0:all=1[a0]');
    // startFrom 5 frames = 0.166667 s; plays 20 frames = 0.666667 s; delayed 1000 ms
    expect(parts[1]).toContain('[2:a]atrim=start=0.166667:end=0.833333');
    expect(parts[1]).toContain('adelay=1000:all=1[a1]');
    expect(parts[2]).toBe('[a0][a1]amix=inputs=2:normalize=0:duration=longest,apad=whole_dur=3,atrim=end=3,asetpts=PTS-STARTPTS[aout]');
  });
  it('clips `to` beyond the video end and drops empty tracks', () => {
    const g = buildAudioGraph([t({ to: 500 }), t({ from: 10, to: 10 })], { fps: 30, durationFrames: 60, resolve })!;
    expect(g.inputs).toHaveLength(1);
    expect(g.filterComplex).toContain('atrim=start=0:end=2');
  });
});

describe('windowTracks', () => {
  it('rebases to the window start, moving the cut into startFrom', () => {
    const out = windowTracks([t({ from: 10, to: 100, startFrom: 2 }), t({ from: 100 }), t({ from: 0, to: 20 })], 40, 79);
    expect(out).toEqual([{ ...t({}), from: 0, to: 40, startFrom: 32 }]);
  });
});

describe('resolveSrc', () => {
  const exists = (p: string) => p === '/pub/audio/x.wav' || p === '/assets/audio/x.wav';
  const join = (...p: string[]) => p.join('/').replace(/\/+/g, '/');
  it('searches roots in order', () => {
    expect(resolveSrc('audio/x.wav', ['/assets', '/pub'], exists, join)).toBe('/assets/audio/x.wav');
    expect(resolveSrc('/audio/x.wav?v=1', ['/pub'], exists, join)).toBe('/pub/audio/x.wav');
  });
  it('fails clearly', () => {
    expect(() => resolveSrc('nope.wav', ['/pub'], exists, join)).toThrow(/not found|no encontr/i);
    expect(() => resolveSrc('https://x/y.mp3', ['/pub'], exists, join)).toThrow(/remote/);
  });
});
