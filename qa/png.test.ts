// @vitest-environment node
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePng, sampleRects } from './png';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type: string, body: Buffer) => {
  const t = Buffer.concat([Buffer.from(type, 'latin1'), body]);
  const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(t));
  return Buffer.concat([len, t, c]);
};
/** PNG RGBA de prueba; `filter` fuerza el mismo filtro en todas las filas (0 a 4), aplicado de verdad. */
function encode(w: number, h: number, px: (x: number, y: number) => number[], filter = 0, color = 6): Buffer {
  const ch = color === 6 ? 4 : 3;
  const rows: Buffer[] = [];
  const raw = (x: number, y: number, k: number) => (x < 0 || y < 0 ? 0 : px(x, y)[k]!);
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * ch);
    row[0] = filter;
    for (let x = 0; x < w; x++) for (let k = 0; k < ch; k++) {
      const v = raw(x, y, k), a = raw(x - 1, y, k), up = raw(x, y - 1, k), c = raw(x - 1, y - 1, k);
      const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
      const pred = [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][filter]!;
      row[1 + x * ch + k] = (v - pred) & 255;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = color;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
const pattern = (x: number, y: number) => [(x * 37 + y * 11) & 255, (x * 5 + y * 91) & 255, (x * y) & 255, 255 - ((x + y) & 63)];

describe('decodePng', () => {
  for (const filter of [0, 1, 2, 3, 4]) {
    it(`decodifica RGBA con el filtro ${filter}`, () => {
      const img = decodePng(encode(23, 17, pattern, filter));
      expect([img.width, img.height]).toEqual([23, 17]);
      for (const [x, y] of [[0, 0], [22, 16], [5, 9], [13, 3]] as const) {
        const o = (y * 23 + x) * 4;
        expect([...img.data.slice(o, o + 4)]).toEqual(pattern(x, y));
      }
    });
  }
  it('decodifica RGB (alfa 255)', () => {
    const img = decodePng(encode(8, 8, pattern, 4, 2));
    expect([...img.data.slice(0, 4)]).toEqual([...pattern(0, 0).slice(0, 3), 255]);
  });
  it('rechaza lo que no es PNG', () => {
    expect(() => decodePng(Buffer.from('no es un png'))).toThrow(/firma/);
  });
});

describe('sampleRects', () => {
  const img = decodePng(encode(100, 60, (x) => (x < 50 ? [10, 20, 30, 255] : [200, 210, 220, 255]), 1));
  it('toma la mediana bajo la caja', () => {
    expect(sampleRects(img, [{ x: 0, y: 0, w: 40, h: 20 }, { x: 60, y: 30, w: 30, h: 10 }])).toMatchObject([{ r: 10, g: 20, b: 30 }, { r: 200, g: 210, b: 220 }]);
  });
  it('es null si la caja queda fuera de la imagen', () => {
    expect(sampleRects(img, [{ x: 500, y: 0, w: 10, h: 10 }])).toEqual([null]);
  });
  it('es determinista', () => {
    const r = [{ x: 3.4, y: 2.2, w: 77.7, h: 40.1 }];
    expect(sampleRects(img, r)).toEqual(sampleRects(img, r));
  });
});
