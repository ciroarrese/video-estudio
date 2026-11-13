import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { comparePixels, comparePngs, DEFAULT_TOLERANCE, withinTolerance } from './compare';
import { decodePng, type Pixels } from './png';

const W = 400, H = 250; // 100k pixels: 0.01% = 10 px
const blank = (): Pixels => ({ width: W, height: H, data: new Uint8Array(W * H * 4).fill(128) });
const clone = (p: Pixels): Pixels => ({ ...p, data: p.data.slice() });
const poke = (p: Pixels, x: number, y: number, delta: number) => {
  const o = (y * W + x) * 4;
  p.data[o] = p.data[o]! + delta;
};

describe('tolerant comparison', () => {
  it('(a) identical buffers pass, in default and strict mode', () => {
    const s = comparePixels(blank(), blank());
    expect(s).toMatchObject({ maxDelta: 0, diffPixels: 0, bbox: null });
    expect(withinTolerance(s)).toBe(true);
    expect(withinTolerance(s, { ...DEFAULT_TOLERANCE, strict: true })).toBe(true);
  });
  it('(b) 1-level noise in 0.01% of pixels passes (but fails strict)', () => {
    const b = clone(blank());
    for (let i = 0; i < 10; i++) poke(b, i * 37, i * 11, 1);
    const s = comparePixels(blank(), b);
    expect(s.diffPixels).toBe(10);
    expect(s.ratio).toBeCloseTo(0.0001);
    expect(s.maxDelta).toBe(1);
    expect(withinTolerance(s)).toBe(true);
    expect(withinTolerance(s, { ...DEFAULT_TOLERANCE, strict: true })).toBe(false);
  });
  it('(c) a 40x40 block changed by 30 levels fails, with the right bbox', () => {
    const b = clone(blank());
    for (let y = 100; y < 140; y++) for (let x = 50; x < 90; x++) poke(b, x, y, 30);
    const s = comparePixels(blank(), b);
    expect(s).toMatchObject({ maxDelta: 30, diffPixels: 1600, bbox: [50, 100, 89, 139] });
    expect(withinTolerance(s)).toBe(false);
  });
  it('(d) delta 3 in a few pixels fails; delta 2 passes', () => {
    const b = clone(blank());
    for (let i = 0; i < 4; i++) poke(b, i, 0, 3);
    expect(withinTolerance(comparePixels(blank(), b))).toBe(false);
    const c = clone(blank());
    for (let i = 0; i < 4; i++) poke(c, i, 0, 2);
    expect(withinTolerance(comparePixels(blank(), c))).toBe(true);
  });
  it('small deltas over too many pixels fail on the ratio; thresholds are configurable', () => {
    const b = clone(blank());
    for (let i = 0; i < 200; i++) poke(b, i, 0, 1); // 0.2%
    const s = comparePixels(blank(), b);
    expect(withinTolerance(s)).toBe(false);
    expect(withinTolerance(s, { ...DEFAULT_TOLERANCE, maxRatio: 0.01 })).toBe(true);
  });
  it('different sizes never pass', () => {
    expect(withinTolerance(comparePixels(blank(), { width: 2, height: 2, data: new Uint8Array(16) }))).toBe(false);
  });
});

// Encode an RGBA PNG (filter 0 and filter 1 rows mixed) to check the decoder end to end.
const crc = (() => {
  const t = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  return (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
function encodePng(p: Pixels): Buffer {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(p.width, 0); ihdr.writeUInt32BE(p.height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const rows: Buffer[] = [];
  for (let y = 0; y < p.height; y++) {
    const row = Buffer.from(p.data.subarray(y * p.width * 4, (y + 1) * p.width * 4));
    if (y % 2) { for (let i = row.length - 1; i >= 4; i--) row[i] = (row[i]! - row[i - 4]!) & 255; rows.push(Buffer.concat([Buffer.from([1]), row])); }
    else rows.push(Buffer.concat([Buffer.from([0]), row]));
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

describe('decodePng', () => {
  it('round-trips pixels and feeds comparePngs', () => {
    const a = blank();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; a.data[o] = x; a.data[o + 1] = y; a.data[o + 2] = (x * y) & 255; a.data[o + 3] = 255; }
    const b = clone(a);
    poke(b, 5, 5, 40);
    const d = decodePng(encodePng(a));
    expect(d.width).toBe(W);
    expect(Buffer.from(d.data).equals(Buffer.from(a.data))).toBe(true);
    const s = comparePngs(encodePng(a), encodePng(b));
    expect(s).toMatchObject({ maxDelta: 40, diffPixels: 1, bbox: [5, 5, 5, 5] });
  });
  it('rejects non-PNG input', () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow(/not a PNG/);
  });
});
