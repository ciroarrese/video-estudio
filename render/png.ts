import { inflateSync } from 'node:zlib';

/** Decoded 8-bit image, always 4 channels (RGBA). */
export type Pixels = { width: number; height: number; data: Uint8Array };

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Minimal PNG decoder for what Chromium emits (8-bit gray / gray+alpha / RGB / RGBA, non-interlaced).
 * Chosen over a dependency or an ffmpeg round trip: ~50 lines, synchronous, no process per frame.
 */
export function decodePng(buf: Uint8Array): Pixels {
  if (SIG.some((b, i) => buf[i] !== b)) throw new Error('decodePng: not a PNG');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let width = 0, height = 0, depth = 0, ctype = 0, interlace = 0;
  const idat: Uint8Array[] = [];
  for (let o = 8; o < buf.length; ) {
    const len = dv.getUint32(o);
    const type = String.fromCharCode(buf[o + 4]!, buf[o + 5]!, buf[o + 6]!, buf[o + 7]!);
    const body = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      width = dv.getUint32(o + 8);
      height = dv.getUint32(o + 12);
      depth = buf[o + 16]!;
      ctype = buf[o + 17]!;
      interlace = buf[o + 20]!;
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const ch = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[ctype];
  if (depth !== 8 || interlace !== 0 || !ch) throw new Error(`decodePng: unsupported PNG (depth ${depth}, color type ${ctype}, interlace ${interlace})`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  if (raw.length < height * (stride + 1)) throw new Error(`decodePng: datos truncados (hay ${raw.length} bytes y hacen falta ${height * (stride + 1)})`);
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!;
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch]! : 0;
      const b = prev[i]!;
      const c = i >= ch ? prev[i - ch]! : 0;
      let v = src[i]!;
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (f !== 0) throw new Error(`decodePng: bad filter ${f}`);
      cur[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const s = x * ch;
      if (ch >= 3) { out[o] = cur[s]!; out[o + 1] = cur[s + 1]!; out[o + 2] = cur[s + 2]!; out[o + 3] = ch === 4 ? cur[s + 3]! : 255; }
      else { out[o] = out[o + 1] = out[o + 2] = cur[s]!; out[o + 3] = ch === 2 ? cur[s + 1]! : 255; }
    }
    [prev, cur] = [cur, prev];
  }
  return { width, height, data: out };
}
