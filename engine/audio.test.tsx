import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Audio, FrameProvider, Sequence, Series, clearAudio, collectAudio, createStage, scanAudio, type VideoConfig } from './index';
import { quiet } from './testUtils';
import audioCheck from '../examples/audio-check';

const config: VideoConfig = { fps: 30, width: 10, height: 10, durationInFrames: 300 };

describe('Audio', () => {
  beforeEach(() => clearAudio());

  it('registers absolute start and end through nested Sequences', () => {
    render(
      <FrameProvider frame={100} config={config}>
        <Audio src="top.mp3" />
        <Sequence from={20} durationInFrames={100}>
          <Audio src="a.mp3" volume={0.5} startFrom={12} />
          <Sequence from={30} durationInFrames={500}>
            <Audio src="b.mp3" />
          </Sequence>
        </Sequence>
      </FrameProvider>,
    );
    expect(collectAudio()).toEqual([
      { src: 'top.mp3', from: 0, to: Infinity, startFrom: 0, volume: 1 },
      { src: 'a.mp3', from: 20, to: 120, startFrom: 12, volume: 0.5 },
      { src: 'b.mp3', from: 50, to: 120, startFrom: 0, volume: 1 }, // clipped by the parent's end
    ]);
  });
  it('Series.Item gives each track its own end', () => {
    render(
      <FrameProvider frame={0} config={config}>
        <Series>
          <Series.Item durationInFrames={10}><Audio src="a" /></Series.Item>
          <Series.Item durationInFrames={20}><Audio src="b" /></Series.Item>
        </Series>
      </FrameProvider>,
    );
    // Only item "a" is mounted at frame 0.
    expect(collectAudio().map((t) => [t.src, t.from, t.to])).toEqual([['a', 0, 10]]);
  });
  it('clamps a negative absolute start to 0 and moves the difference into startFrom', () => {
    render(
      <FrameProvider frame={0} config={config}>
        <Sequence from={-10} durationInFrames={50}>
          <Audio src="n.mp3" startFrom={3} />
        </Sequence>
      </FrameProvider>,
    );
    expect(collectAudio()).toEqual([{ src: 'n.mp3', from: 0, to: 40, startFrom: 13, volume: 1 }]);
  });
  it('rejects negative startFrom', () => {
    quiet(() =>
      expect(() =>
        render(<FrameProvider frame={0} config={config}><Audio src="x" startFrom={-1} /></FrameProvider>),
      ).toThrow(/startFrom/),
    );
  });
  it('does not register out-of-range audio and does not duplicate on re-render', () => {
    const ui = (f: number) => (
      <FrameProvider frame={f} config={config}>
        <Sequence from={50} durationInFrames={10}><Audio src="x.mp3" /></Sequence>
      </FrameProvider>
    );
    const r = render(ui(0));
    expect(collectAudio()).toEqual([]);
    r.rerender(ui(55));
    r.rerender(ui(56));
    expect(collectAudio()).toHaveLength(1);
    r.rerender(ui(70));
    expect(collectAudio()).toHaveLength(1);
  });
});

describe('scanAudio', () => {
  it('returns root-level and nested tracks, even when the registry was cleared while mounted', () => {
    const host = document.createElement('div');
    const stage = createStage(host, audioCheck);
    stage.render(35);
    clearAudio(); // simulate stale/cleared registry while the root Audio stays mounted
    const tracks = scanAudio(stage);
    expect(tracks).toEqual([
      { src: 'audio/root.wav', from: 0, to: Infinity, startFrom: 0, volume: 0.8 },
      { src: 'audio/nested.wav', from: 30, to: 50, startFrom: 5, volume: 1 },
      { src: 'audio/deep.wav', from: 40, to: 50, startFrom: 0, volume: 1 },
    ]);
    expect(stage.current()).toBe(35); // restored
    expect(scanAudio(stage)).toBe(tracks); // cached
    stage.destroy();
  });
});
