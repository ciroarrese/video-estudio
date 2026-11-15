import { describe, expect, it } from 'vitest';
import { parseCliArgs, parseTiempo } from './args';

describe('parseCliArgs', () => {
  it('uses defaults', () => {
    expect(parseCliArgs(['hello'])).toMatchObject({
      videoId: 'hello', props: {}, scale: 1, crf: 18, segment: 150, audio: true, cache: true, keepFrames: false, frameFormat: 'png', jpegQuality: 95, check: false, checkMaxDelta: 2, checkMaxRatio: 0.001, checkStrict: false, assets: [],
    });
  });
  it('parses every option', () => {
    const o = parseCliArgs(['v', '--out', 'x.mp4', '--props', '{"a":1}', '--frames', '10-20', '--concurrency', '3', '--scale', '0.5',
      '--crf', '23', '--segment', '60', '--no-audio', '--no-cache', '--keep-frames', '--frame-format', 'jpeg', '--jpeg-quality', '90', '--check', '--check-max-delta', '3', '--check-max-ratio', '0.01', '--check-strict', '--assets', 'a', '--assets', 'b']);
    expect(o).toMatchObject({ out: 'x.mp4', props: { a: 1 }, frames: [10, 20], concurrency: 3, scale: 0.5, crf: 23, segment: 60,
      audio: false, cache: false, keepFrames: true, frameFormat: 'jpeg', jpegQuality: 90, check: true, checkMaxDelta: 3, checkMaxRatio: 0.01, checkStrict: true, assets: ['a', 'b'] });
  });
  it('accepts a single frame', () => {
    expect(parseCliArgs(['v', '--frames', '7']).frames).toEqual([7, 7]);
  });
  it('rejects invalid input', () => {
    expect(() => parseCliArgs([])).toThrow(/videoId/);
    expect(() => parseCliArgs(['a', 'b'])).toThrow();
    expect(() => parseCliArgs(['v', '--props', '[1]'])).toThrow(/objeto/);
    expect(() => parseCliArgs(['v', '--props', '{bad'])).toThrow(/JSON/);
    expect(() => parseCliArgs(['v', '--frames', '9-3'])).toThrow();
    expect(() => parseCliArgs(['v', '--frames', 'x'])).toThrow();
    expect(() => parseCliArgs(['v', '--concurrency', '0'])).toThrow();
    expect(() => parseCliArgs(['v', '--crf', '60'])).toThrow();
    expect(() => parseCliArgs(['v', '--scale', '0'])).toThrow();
    expect(() => parseCliArgs(['v', '--nope'])).toThrow();
    expect(() => parseCliArgs(['v', '--check-max-ratio', '2'])).toThrow();
    expect(() => parseCliArgs(['v', '--check-max-delta', '-1'])).toThrow();
    expect(() => parseCliArgs(['v', '--frame-format', 'gif'])).toThrow();
  });
  it('handles --help without videoId', () => {
    expect(parseCliArgs(['--help']).help).toBe(true);
  });

  it('audio: tasa del AAC y pico máximo del audio codificado', () => {
    expect(parseCliArgs(['v'])).toMatchObject({ audioBitrate: '192k', audioPeakMax: -1, audioPeakStrict: false, audioPeakCheck: true });
    expect(parseCliArgs(['v', '--audio-bitrate', '256k', '--audio-peak-max', '-2.5', '--audio-peak-strict'])).toMatchObject({ audioBitrate: '256k', audioPeakMax: -2.5, audioPeakStrict: true });
    expect(parseCliArgs(['v', '--audio-peak-max=-3', '--no-audio-peak-check']).audioPeakMax).toBe(-3);
    expect(parseCliArgs(['v', '--audio-peak-max', '-3', '--frames', '1-5'])).toMatchObject({ audioPeakMax: -3, frames: [1, 5] });
    expect(() => parseCliArgs(['v', '--audio-bitrate', 'mucho'])).toThrow(/--audio-bitrate/);
    expect(() => parseCliArgs(['v', '--audio-peak-max', '9'])).toThrow(/--audio-peak-max/);
    expect(() => parseCliArgs(['v', '--audio-peak-strict', '--no-audio-peak-check'])).toThrow(/contradicen/);
  });
  it('--seconds: tramo en segundos o m:ss, sin combinarse con --frames ni --scene', () => {
    expect(parseCliArgs(['v', '--seconds', '12.5-20']).seconds).toEqual([12.5, 20]);
    expect(parseCliArgs(['v', '--seconds', '1:30-2:05.5']).seconds).toEqual([90, 125.5]);
    expect(parseTiempo('t', '1:02:03')).toBe(3723);
    expect(() => parseCliArgs(['v', '--seconds', '20-10'])).toThrow(/mayor/);
    expect(() => parseCliArgs(['v', '--seconds', '10'])).toThrow(/a-b/);
    expect(() => parseCliArgs(['v', '--seconds', 'a-b'])).toThrow(/tiempo/);
    expect(() => parseCliArgs(['v', '--seconds', '1-2', '--frames', '1-2'])).toThrow(/no se combina/);
    expect(() => parseCliArgs(['v', '--seconds', '1-2', '--scene', 'x'])).toThrow(/no se combina/);
  });
});
