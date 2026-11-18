// Por qué `render` no reutilizó la caché de partes.
//
// La clave de una parte es un hash: si cambia, solo se sabe que "no está". Para poder decir por qué, cada render deja en
// `.ve-cache/ultimo-<video+formato>.json` los ingredientes de su clave (huella del código con el hash de cada archivo, props,
// escala, crf, versiones y opciones de captura). El siguiente render los compara con los suyos. Es solo diagnóstico: la decisión de
// reutilizar la toma la clave (y el manifiesto de estáticos, ver estaticos.ts); si este archivo falta o está roto, solo cambia el texto.
import { createHash } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type RegistroClave = {
  /** Huella del código del video (o hash de todo el bundle si no se pudo aislar el video). */
  codigo: string;
  /** Hash de cada archivo que entra a la huella; ausente cuando la huella es la del bundle entero. */
  archivos?: Record<string, string>;
  props: string;
  scale: number;
  crf: number;
  segment: number;
  /** El resto de lo que cambia los cuadros (ffmpeg, Chromium, fps, tamaño, formato, codificador, captura...). */
  env: Record<string, unknown>;
};

export const archivoDeRegistro = (cacheDir: string, videoId: string, formato: string | undefined): string =>
  join(cacheDir, `ultimo-${createHash('sha1').update(`${videoId}|${formato ?? ''}`).digest('hex').slice(0, 12)}.json`);

export function leerRegistro(archivo: string): RegistroClave | null {
  try {
    const r = JSON.parse(readFileSync(archivo, 'utf8')) as RegistroClave;
    return typeof r?.codigo === 'string' ? r : null;
  } catch {
    return null;
  }
}

export function guardarRegistro(archivo: string, r: RegistroClave): void {
  try {
    const tmp = `${archivo}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(r));
    renameSync(tmp, archivo);
  } catch {
    /* es solo diagnóstico */
  }
}

const lista = (xs: string[], max = 4) => (xs.length <= max ? xs.join(', ') : `${xs.slice(0, max).join(', ')} y ${xs.length - max} más`);

/** Rótulo en español de cada ingrediente de `env`. */
const ROTULOS_ENV: Record<string, string> = {
  ffmpeg: 'la versión de ffmpeg',
  chromium: 'la versión de Chromium',
  chromiumArgs: 'VE_CHROMIUM_ARGS',
  chromiumBin: 'VE_CHROMIUM',
  fps: 'los cuadros por segundo',
  width: 'el ancho',
  height: 'el alto',
  format: 'el formato (horizontal, vertical, cuadrado)',
  encoder: 'los ajustes del codificador',
  frameFormat: 'el formato de captura',
  jpegQuality: 'la calidad JPEG',
};

/**
 * Motivos (en español) por los que las partes de `ahora` no coinciden con las del render anterior `antes`.
 * Devuelve `[]` si los ingredientes son iguales: entonces la parte simplemente no estaba (rango nuevo, caché borrada).
 */
export function explicarCambio(antes: RegistroClave | null, ahora: RegistroClave): string[] {
  if (!antes) return ['no había entrada en la caché para este video (primer render, o caché borrada)'];
  const motivos: string[] = [];
  if (antes.codigo !== ahora.codigo) {
    if (antes.archivos && ahora.archivos) {
      const nombres = new Set([...Object.keys(antes.archivos), ...Object.keys(ahora.archivos)]);
      const cambiados = [...nombres].filter((n) => antes.archivos![n] !== ahora.archivos![n]).sort();
      motivos.push(cambiados.length ? `cambió el código del video (${lista(cambiados)})` : 'cambió el código del video');
    } else motivos.push('cambió el bundle (el código del video, del motor o de otro video; no se pudo aislar este video)');
  }
  if (antes.props !== ahora.props) motivos.push('cambiaron las props');
  if (antes.scale !== ahora.scale) motivos.push(`cambió la escala (${antes.scale} -> ${ahora.scale})`);
  if (antes.segment !== ahora.segment) motivos.push(`cambió --segment (${antes.segment} -> ${ahora.segment}): las partes tienen otro rango`);
  if (antes.crf !== ahora.crf) motivos.push(`cambió el crf (${antes.crf} -> ${ahora.crf})`);
  const claves = new Set([...Object.keys(antes.env), ...Object.keys(ahora.env)]);
  const distintas = [...claves].filter((k) => JSON.stringify(antes.env[k]) !== JSON.stringify(ahora.env[k]));
  if (distintas.length) motivos.push(`cambió el formato u opciones de render (${lista(distintas.map((k) => ROTULOS_ENV[k] ?? k))})`);
  return motivos;
}
