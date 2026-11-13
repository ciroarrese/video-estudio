// Utilidades mínimas para hablar con ffmpeg: decodificar a PCM float, codificar PCM float
// y escribir WAV de 16 bits. Sin dependencias fuera de Node.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/** Corre ffmpeg y devuelve stdout. Rechaza con el final de stderr si falla. */
export function runFfmpeg(args: string[], stdin?: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on('data', (d: Buffer) => out.push(d));
    p.stderr.on('data', (d: Buffer) => err.push(d));
    p.on('error', (e) => reject(new Error(`No se pudo ejecutar ffmpeg: ${e.message}`)));
    p.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`ffmpeg falló (código ${code}): ${Buffer.concat(err).toString().slice(-600)}`));
    });
    p.stdin.on('error', () => {});
    if (stdin) p.stdin.end(stdin);
    else p.stdin.end();
  });
}

export function hayFfmpeg(): boolean {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
}

/** Decodifica cualquier archivo a PCM float32 entrelazado. */
export async function decodificar(
  archivo: string,
  opts: { sr: number; canales: 1 | 2 },
): Promise<Float32Array> {
  const buf = await runFfmpeg(['-i', archivo, '-vn', '-ac', String(opts.canales), '-ar', String(opts.sr), '-f', 'f32le', 'pipe:1']);
  const copia = new Uint8Array(buf.byteLength - (buf.byteLength % 4));
  copia.set(buf.subarray(0, copia.length));
  return new Float32Array(copia.buffer);
}

/** Codifica PCM float32 entrelazado al formato que indique la extensión de `salida`. */
export async function codificar(
  muestras: Float32Array,
  opts: { sr: number; canales: 1 | 2; salida: string },
): Promise<void> {
  mkdirSync(dirname(opts.salida), { recursive: true });
  const buf = Buffer.from(muestras.buffer, muestras.byteOffset, muestras.byteLength);
  await runFfmpeg(['-y', '-f', 'f32le', '-ar', String(opts.sr), '-ac', String(opts.canales), '-i', 'pipe:0', opts.salida], buf);
}

/** Escribe un WAV mono o estéreo de 16 bits (sin ffmpeg). */
export function escribirWav16(archivo: string, muestras: Float32Array, sr: number, canales: 1 | 2 = 1): void {
  const datos = Buffer.alloc(muestras.length * 2);
  for (let i = 0; i < muestras.length; i++) {
    const v = Math.max(-1, Math.min(1, muestras[i]));
    datos.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0);
  cab.writeUInt32LE(36 + datos.length, 4);
  cab.write('WAVEfmt ', 8);
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);
  cab.writeUInt16LE(canales, 22);
  cab.writeUInt32LE(sr, 24);
  cab.writeUInt32LE(sr * canales * 2, 28);
  cab.writeUInt16LE(canales * 2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write('data', 36);
  cab.writeUInt32LE(datos.length, 40);
  mkdirSync(dirname(archivo), { recursive: true });
  writeFileSync(archivo, Buffer.concat([cab, datos]));
}
