// Utilidades mínimas para hablar con ffmpeg: decodificar a PCM float, codificar PCM float
// y escribir WAV de 16 bits. Sin dependencias fuera de Node.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

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
  // Ruta absoluta: una que empiece con "-" ffmpeg la leería como opción.
  const buf = await runFfmpeg(['-i', resolve(archivo), '-vn', '-ac', String(opts.canales), '-ar', String(opts.sr), '-f', 'f32le', 'pipe:1']);
  const copia = new Uint8Array(buf.byteLength - (buf.byteLength % 4));
  copia.set(buf.subarray(0, copia.length));
  return new Float32Array(copia.buffer);
}

/**
 * Codifica PCM float32 entrelazado al formato que indique la extensión de `salida`. En `.wav`,
 * `bits` elige 16, 24 o 32 (float); sin `bits` ffmpeg usa 16. Para un archivo que después se sigue
 * procesando conviene 24 o 32: 16 bits recorta cualquier cresta que pase de 0 dBFS.
 */
export async function codificar(
  muestras: Float32Array,
  opts: { sr: number; canales: 1 | 2; salida: string; bits?: 16 | 24 | 32 },
): Promise<void> {
  const buf = Buffer.from(muestras.buffer, muestras.byteOffset, muestras.byteLength);
  const codec = opts.bits && extname(opts.salida).toLowerCase() === '.wav' ? ['-c:a', { 16: 'pcm_s16le', 24: 'pcm_s24le', 32: 'pcm_f32le' }[opts.bits]] : [];
  await escribirAtomico(opts.salida, (tmp) =>
    runFfmpeg(['-y', '-f', 'f32le', '-ar', String(opts.sr), '-ac', String(opts.canales), '-i', 'pipe:0', ...codec, tmp], buf).then(() => undefined),
  );
}

export interface Sonda {
  canales: number;
  codec: string;
  sr: number;
  /** `start_time` del contenedor (s). Un mp3 con etiqueta Xing/LAME marca ~0,025 s; sin etiqueta, 0. */
  inicioSec: number;
}

/** Lee canales, códec y `start_time` con ffprobe; null si ffprobe no está o no entiende el archivo. */
export function sondear(archivo: string): Sonda | null {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels,codec_name,sample_rate,start_time', '-of', 'json', resolve(archivo)], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) return null;
  try {
    const st = (JSON.parse(r.stdout) as { streams?: { channels?: number; codec_name?: string; sample_rate?: string; start_time?: string }[] }).streams?.[0];
    if (!st) return null;
    return { canales: st.channels ?? 2, codec: st.codec_name ?? '', sr: Number(st.sample_rate ?? 0), inicioSec: Number(st.start_time ?? 0) || 0 };
  } catch {
    return null;
  }
}

/**
 * Aviso para un mp3 sin etiqueta Xing/LAME: sin ella no se sabe cuántas muestras de retardo del
 * codificador hay que descartar (unos 25 ms), así que según el decodificador el audio arranca ese
 * tiempo antes o después. Para que el análisis y la reproducción midan sobre las mismas muestras
 * conviene convertirlo una vez a wav y usar el wav en todos los pasos. Devuelve undefined si no es
 * mp3, si tiene la etiqueta o si no se pudo sondear.
 */
export function avisoMp3SinEtiqueta(archivo: string): string | undefined {
  const s = sondear(archivo);
  if (!s || s.codec !== 'mp3' || s.inicioSec > 0.0005) return undefined;
  return `"${archivo}" es un mp3 sin etiqueta Xing/LAME: ffmpeg no descarta el retardo del codificador y lo decodifica unos 25 ms tarde respecto de otros reproductores. Convertilo una vez a wav (ffmpeg -i entrada.mp3 salida.wav) y usá el wav en tempo, empalme y mezcla, así todo mide sobre las mismas muestras.`;
}

/**
 * Escribe `salida` de forma atómica: `escribir` recibe una ruta temporal absoluta (al lado de la
 * salida y con su misma extensión, para que ffmpeg elija el formato) y, si termina bien, se renombra
 * a `salida`. Si falla se borra lo parcial y la salida anterior, si existía, queda intacta.
 */
export async function escribirAtomico(salida: string, escribir: (tmp: string) => Promise<void>): Promise<string> {
  const destino = resolve(salida);
  mkdirSync(dirname(destino), { recursive: true });
  const ext = extname(destino);
  const tmp = join(dirname(destino), `.${basename(destino, ext)}.parcial-${process.pid}${ext}`);
  try {
    await escribir(tmp);
    renameSync(tmp, destino);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
  return destino;
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
