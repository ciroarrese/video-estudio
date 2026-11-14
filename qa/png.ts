// Decodificador mínimo de PNG y muestreo de fondos, en Node. Antes el muestreo se hacía dentro de la página (Image + canvas):
// de vez en cuando devolvía otros colores para el MISMO PNG (la decodificación/lectura del canvas de la página no es determinista
// bajo carga), y el contraste saltaba entre corridas. Acá todo es aritmética sobre bytes: misma captura, mismo resultado.
import { inflateSync } from 'node:zlib';
import type { Rect } from './types';

export type Raster = { width: number; height: number; /** RGBA, 4 bytes por pixel. */ data: Uint8Array };

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Decodifica un PNG no entrelazado de 8 bits (gris, gris+alfa, RGB, RGBA o paleta): lo que escribe `Page.captureScreenshot`. */
export function decodePng(buf: Uint8Array): Raster {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 8 || SIGNATURE.some((v, i) => b[i] !== v)) throw new Error('PNG invalido: falta la firma');
  let pos = 8;
  let width = 0, height = 0, depth = 0, color = 0, interlace = 0;
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos + 8 <= b.length) {
    const len = b.readUInt32BE(pos);
    const type = b.toString('latin1', pos + 4, pos + 8);
    const body = b.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]!; color = body[9]!; interlace = body[12]!; }
    else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
  }
  if (!width || !height) throw new Error('PNG invalido: sin IHDR');
  if (depth !== 8 || interlace !== 0) throw new Error(`PNG no soportado (profundidad ${depth}, entrelazado ${interlace})`);
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color];
  if (!channels) throw new Error(`PNG no soportado (tipo de color ${color})`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error('PNG invalido: datos truncados');
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x]!;
      const a = x >= channels ? px[dst + x - channels]! : 0;
      const up = y > 0 ? px[dst - stride + x]! : 0;
      const c = x >= channels && y > 0 ? px[dst - stride + x - channels]! : 0;
      let r: number;
      switch (filter) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + up; break;
        case 3: r = v + ((a + up) >> 1); break;
        case 4: {
          const p = a + up - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
          r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c);
          break;
        }
        default: throw new Error(`PNG invalido: filtro ${filter}`);
      }
      px[dst + x] = r & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (color === 6) { data[o] = px[i * 4]!; data[o + 1] = px[i * 4 + 1]!; data[o + 2] = px[i * 4 + 2]!; data[o + 3] = px[i * 4 + 3]!; }
    else if (color === 2) { data[o] = px[i * 3]!; data[o + 1] = px[i * 3 + 1]!; data[o + 2] = px[i * 3 + 2]!; data[o + 3] = 255; }
    else if (color === 0) { data[o] = data[o + 1] = data[o + 2] = px[i]!; data[o + 3] = 255; }
    else if (color === 4) { data[o] = data[o + 1] = data[o + 2] = px[i * 2]!; data[o + 3] = px[i * 2 + 1]!; }
    else {
      const k = px[i]!;
      data[o] = palette?.[k * 3] ?? 0; data[o + 1] = palette?.[k * 3 + 1] ?? 0; data[o + 2] = palette?.[k * 3 + 2] ?? 0; data[o + 3] = trns?.[k] ?? 255;
    }
  }
  return { width, height, data };
}

export type BgSample = { r: number; g: number; b: number; samples: number };

const median = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1]!;

/** Mediana de los pixeles bajo cada rectángulo (grilla de hasta ~40x20 puntos). `null` si el rectángulo queda fuera de la imagen. */
export function sampleRects(img: Raster, rects: Rect[]): (BgSample | null)[] {
  return rects.map((r) => {
    const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(img.width, Math.ceil(r.x + r.w)), y1 = Math.min(img.height, Math.ceil(r.y + r.h));
    if (x1 <= x0 || y1 <= y0) return null;
    const stepX = Math.max(1, Math.floor((x1 - x0) / 40)), stepY = Math.max(1, Math.floor((y1 - y0) / 20));
    const R: number[] = [], G: number[] = [], B: number[] = [];
    for (let y = y0; y < y1; y += stepY) for (let x = x0; x < x1; x += stepX) {
      const o = (y * img.width + x) * 4;
      R.push(img.data[o]!); G.push(img.data[o + 1]!); B.push(img.data[o + 2]!);
    }
    return { r: median(R), g: median(G), b: median(B), samples: R.length };
  });
}

/** Diferencia (maximo por canal, 0 a 255) a partir de la cual un pixel cuenta como "tinta": el texto de abajo de una capa casi opaca (0.9) cambia menos que esto. */
export const INK_DIFF = 40;

/**
 * Para cada texto (sus rectangulos de linea), la fraccion de pixeles que cambian entre la captura normal y la captura con el texto
 * oculto: evidencia de que el texto SE VE en pantalla (o no), independiente de la heuristica de tapados. `null` si todos los
 * rectangulos quedan fuera de la imagen o las capturas no tienen el mismo tamano. Aritmetica pura sobre bytes: misma captura, mismo resultado.
 */
export function inkFractions(normal: Raster, hidden: Raster, texts: Rect[][]): ({ frac: number } | null)[] {
  if (normal.width !== hidden.width || normal.height !== hidden.height) return texts.map(() => null);
  return texts.map((lines) => {
    let seen = 0, changed = 0;
    for (const r of lines.slice(0, 8)) {
      const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
      const x1 = Math.min(normal.width, Math.ceil(r.x + r.w)), y1 = Math.min(normal.height, Math.ceil(r.y + r.h));
      if (x1 <= x0 || y1 <= y0) continue;
      const step = Math.max(1, Math.ceil(Math.sqrt(((x1 - x0) * (y1 - y0)) / 6000)));
      for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
        const o = (y * normal.width + x) * 4;
        const d = Math.max(Math.abs(normal.data[o]! - hidden.data[o]!), Math.abs(normal.data[o + 1]! - hidden.data[o + 1]!), Math.abs(normal.data[o + 2]! - hidden.data[o + 2]!));
        seen++;
        if (d >= INK_DIFF) changed++;
      }
    }
    return seen ? { frac: changed / seen } : null;
  });
}
