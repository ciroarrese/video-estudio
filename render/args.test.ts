import { describe, expect, it } from 'vitest';
import { parseCliArgs } from './args';

describe('parseCliArgs', () => {
  it('uses defaults', () => {
    expect(parseCliArgs(['hello'])).toMatchObject({
      videoId: 'hello', props: {}, scale: 1, crf: 18, segment: 150, audio: true, cache: true, keepFrames: false, frameFormat: 'png', jpegQuality: 95, check: false, assets: [],
    });
  });
  it('parses every option', () => {
    const o = parseCliArgs(['v', '--out', 'x.mp4', '--props', '{"a":1}', '--frames', '10-20', '--concurrency', '3', '--scale', '0.5',
      '--crf', '23', '--segment', '60', '--no-audio', '--no-cache', '--keep-frames', '--frame-format', 'jpeg', '--jpeg-quality', '90', '--check', '--assets', 'a', '--assets', 'b']);
    expect(o).toMatchObject({ out: 'x.mp4', props: { a: 1 }, frames: [10, 20], concurrency: 3, scale: 0.5, crf: 23, segment: 60,
      audio: false, cache: false, keepFrames: true, frameFormat: 'jpeg', jpegQuality: 90, check: true, assets: ['a', 'b'] });
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
    expect(() => parseCliArgs(['v', '--frame-format', 'gif'])).toThrow();
  });
  it('handles --help without videoId', () => {
    expect(parseCliArgs(['--help']).help).toBe(true);
  });
});
