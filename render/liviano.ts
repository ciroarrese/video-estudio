// `--liviano [MB]`: copia del mp4 final que pesa como mucho `MB` mebibytes (1 MB = 1024 x 1024 bytes, como cuentan los canales de
// entrega), al lado del original como `<salida>-liviano.mp4`. El audio se copia sin recodificar; el video se recodifica con la tasa
// que sale de la duración y el tope. Se mide el tamaño real y, si se pasó, se reintenta una vez con una tasa más baja.
import { copyFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { run } from './render';

export const LIVIANO_MB_POR_DEFECTO = 25;
const MIB = 1024 * 1024;

/** `a/b/x.mp4` -> `a/b/x-liviano.mp4` */
export const salidaLiviana = (out: string): string => out.replace(/\.mp4$/i, '') + '-liviano.mp4';

/**
 * Tasa de video (bits por segundo) para que el archivo entre en `topeBytes`: lo que queda después del audio, con un margen para el
 * contenedor y la imprecisión del codificador (`margen` = fracción del tope que se apunta a usar). `null` si no alcanza ni para el audio.
 */
export function tasaDeVideo(o: { duracion: number; topeBytes: number; audioBps: number; margen?: number }): number | null {
  const margen = o.margen ?? 0.95;
  const bytesVideo = o.topeBytes * margen - (o.audioBps * o.duracion) / 8;
  const bps = (bytesVideo * 8) / o.duracion;
  return Number.isFinite(bps) && bps >= 20_000 ? Math.floor(bps) : null;
}

type Sonda = { duracion: number; audioBps: number | null };

async function sondar(archivo: string): Promise<Sonda> {
  const j = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,bit_rate', '-of', 'json', archivo])) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; bit_rate?: string }[];
  };
  const duracion = Number(j.format?.duration);
  if (!Number.isFinite(duracion) || duracion <= 0) throw new Error(`no se pudo leer la duración de ${archivo}`);
  const audio = j.streams?.find((s) => s.codec_type === 'audio');
  return { duracion, audioBps: audio ? Number(audio.bit_rate) || 192_000 : null };
}

export type ResultadoLiviano = { out: string; bytes: number; topeBytes: number; /** `false` si ni con el reintento entró en el tope. */ ok: boolean; videoBps: number | null };

/**
 * Crea la copia liviana de `origen`. Si `origen` ya entra en el tope la copia es idéntica (no hace falta recodificar).
 * Lanza si el tope no alcanza ni para el audio. Si el video no entra tras el reintento, deja el archivo y devuelve `ok: false`.
 */
export async function copiaLiviana(origen: string, mb: number, log: (m: string) => void = () => {}, destino: string = salidaLiviana(origen)): Promise<ResultadoLiviano> {
  const topeBytes = Math.floor(mb * MIB);
  const tam = statSync(origen).size;
  if (tam <= topeBytes) {
    copyFileSync(origen, destino);
    log(`liviano: el original ya pesa ${(tam / MIB).toFixed(1)} MB (tope ${mb} MB); copia idéntica en ${destino}`);
    return { out: destino, bytes: tam, topeBytes, ok: true, videoBps: null };
  }
  const { duracion, audioBps } = await sondar(origen);
  let bps = tasaDeVideo({ duracion, topeBytes, audioBps: audioBps ?? 0 });
  if (bps === null) throw new Error(`--liviano ${mb}: ${mb} MB no alcanzan para ${duracion.toFixed(1)} s de video${audioBps ? ' con su audio' : ''}; pedí un tope mayor o recortá el video`);
  const tmp = `${destino}.${process.pid}.tmp.mp4`;
  const registro = join(dirname(destino), `.liviano-${process.pid}`); // estadísticas de la primera pasada (ffmpeg agrega sufijos)
  let bytes = 0;
  const videoBase = ['-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p'];
  try {
    for (let intento = 1; intento <= 2; intento++) {
      // Primer intento: una pasada (rápida). Si se pasó del tope, el segundo va en dos pasadas: apunta a la tasa con mucha más exactitud.
      const dosPasadas = intento === 2;
      log(`liviano: intento ${intento}${dosPasadas ? ' (dos pasadas)' : ''}, video a ${Math.round(bps! / 1000)} kbps (tope ${mb} MB, ${duracion.toFixed(1)} s)`);
      const tasa = ['-b:v', String(bps), '-maxrate', String(Math.round(bps! * 1.1)), '-bufsize', String(Math.round(bps! * 2))];
      if (dosPasadas) await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', origen, '-an', ...videoBase, ...tasa, '-pass', '1', '-passlogfile', registro, '-f', 'null', '-']);
      await run('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', origen,
        '-map', '0:v:0', '-map', '0:a?', ...videoBase, ...tasa, ...(dosPasadas ? ['-pass', '2', '-passlogfile', registro] : []),
        '-c:a', 'copy', '-movflags', '+faststart', tmp,
      ]);
      bytes = statSync(tmp).size;
      if (bytes <= topeBytes) break;
      if (intento === 1) {
        // se pasó: la tasa efectiva fue mayor que la pedida; se corrige por lo medido y se baja un poco más
        const nueva = Math.floor(bps! * (topeBytes / bytes) * 0.93);
        log(`liviano: quedó en ${(bytes / MIB).toFixed(1)} MB (tope ${mb} MB); se reintenta con ${Math.round(nueva / 1000)} kbps`);
        if (nueva < 20_000) break;
        bps = nueva;
      }
    }
    const ok = bytes <= topeBytes;
    renameSync(tmp, destino);
    log(`liviano: ${destino} (${(bytes / MIB).toFixed(1)} MB${ok ? '' : `, SUPERA el tope de ${mb} MB`})`);
    return { out: destino, bytes, topeBytes, ok, videoBps: bps };
  } finally {
    rmSync(tmp, { force: true });
    for (const f of readdirSync(dirname(destino))) if (f.startsWith(basename(registro))) rmSync(join(dirname(destino), f), { force: true });
  }
}
