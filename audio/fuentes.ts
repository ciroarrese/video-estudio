// Fuentes de audio en mp3: se convierten a wav una vez al entrar a cualquier comando (tempo, empalme, mezcla, informe), así todos miden sobre las mismas
// muestras (un mp3 sin etiqueta Xing/LAME se decodifica unos 25 ms corrido según el reproductor; ver `avisoMp3SinEtiqueta`).
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { escribirAtomico, runFfmpeg, sondear } from './ffmpeg';

/** Nombre de la subcarpeta de la carpeta `audio/` de un video donde caen los intermedios que no se sirven ni se versionan. */
export const CARPETA_FUENTES = 'fuentes';

export function esMp3(archivo: string): boolean {
  if (extname(archivo).toLowerCase() === '.mp3') return true;
  return sondear(archivo)?.codec === 'mp3';
}

/**
 * Dónde se escribe el wav convertido de `archivo` (ruta absoluta): si el mp3 está en una carpeta `audio/` (la de un video: `videos/<slug>/audio/`),
 * en `audio/fuentes/<nombre>.wav` al lado; si no, en una carpeta temporal del sistema (fuera del repo), con un nombre que depende de la ruta, el
 * tamaño y la fecha del mp3. Función pura (no toca el disco).
 */
export function destinoDeConversion(archivo: string, tmp: string = tmpdir(), tam = 0, mtimeMs = 0): string {
  const abs = resolve(archivo);
  const nombre = basename(abs, extname(abs));
  if (basename(dirname(abs)) === 'audio') return join(dirname(abs), CARPETA_FUENTES, `${nombre}.wav`);
  const h = createHash('sha1').update(`${abs}|${tam}|${mtimeMs}`).digest('hex').slice(0, 12);
  return join(tmp, 've-audio-fuentes', `${nombre}-${h}.wav`);
}

export interface Conversion {
  /** Ruta que hay que usar de acá en más (el wav, o la misma entrada si no era mp3). */
  ruta: string;
  /** El wav se acaba de escribir (false si ya estaba y era más nuevo que el mp3, o si no hubo conversión). */
  convertido: boolean;
  /** La entrada era un mp3. */
  eraMp3: boolean;
}

/**
 * Si `archivo` es mp3 lo convierte a wav de 24 bits (mismo sr y canales; el decodificador de ffmpeg, como lo haría cualquier paso) y devuelve la ruta del wav;
 * si ya se convirtió y el wav es más nuevo que el mp3, lo reusa. Cualquier otro formato se devuelve tal cual. Misma entrada, mismo wav.
 */
export async function aWavSiMp3(archivo: string): Promise<Conversion> {
  const abs = resolve(archivo);
  if (!existsSync(abs) || !esMp3(abs)) return { ruta: archivo, convertido: false, eraMp3: false };
  const st = statSync(abs);
  const destino = destinoDeConversion(abs, tmpdir(), st.size, st.mtimeMs);
  if (existsSync(destino) && statSync(destino).mtimeMs >= st.mtimeMs) return { ruta: destino, convertido: false, eraMp3: true };
  await escribirAtomico(destino, (tmp) => runFfmpeg(['-y', '-i', abs, '-vn', '-c:a', 'pcm_s24le', tmp]).then(() => undefined));
  return { ruta: destino, convertido: true, eraMp3: true };
}
