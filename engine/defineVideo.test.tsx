import { describe, expect, it } from 'vitest';
import { defineVideo, getVideo, getVideos } from './index';

const C = () => null;
const base = { component: C, fps: 30, width: 100, height: 50, durationInFrames: 10 };

describe('defineVideo', () => {
  it('registers and lists videos', () => {
    defineVideo({ id: 'one', ...base, defaultProps: { a: 1 } });
    defineVideo({ id: 'two', ...base });
    expect(getVideos().map((v) => v.id)).toEqual(['one', 'two']);
    expect(getVideo('one')?.defaultProps).toEqual({ a: 1 });
    expect(getVideo('nope')).toBeUndefined();
  });
  it('replaces on duplicate id', () => {
    defineVideo({ id: 'one', ...base, durationInFrames: 99 });
    expect(getVideos().filter((v) => v.id === 'one')).toHaveLength(1);
    expect(getVideo('one')?.durationInFrames).toBe(99);
  });
  it('validates config', () => {
    expect(() => defineVideo({ id: 'bad', ...base, fps: 0 })).toThrow(/fps/);
    expect(() => defineVideo({ id: '', ...base })).toThrow(/id/);
    expect(() => defineVideo({ id: 'bad', ...base, durationInFrames: 10.5 })).toThrow(/durationInFrames tiene que ser un entero positivo/);
    expect(() => defineVideo({ id: 'bad', ...base, width: NaN })).toThrow(/width/);
    expect(() => defineVideo({ id: 'bad', ...base, height: -2 })).toThrow(/height/);
    expect(() => defineVideo({ id: 'bad', ...base, fps: 29.97 })).not.toThrow();
  });
});
