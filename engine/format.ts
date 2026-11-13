import type { VideoConfig } from './config';

/** Formatos de pantalla que soporta el motor: 16:9, vertical y cuadrado. */
export type FormatName = 'horizontal' | 'vertical' | 'cuadrado';
export const FORMAT_NAMES: readonly FormatName[] = ['horizontal', 'vertical', 'cuadrado'];
export type FormatSize = { width: number; height: number };

/**
 * Formatos que admite un video: una lista de nombres (los tamaños se derivan del tamaño base) o un objeto
 * con el tamaño de cada uno. Sin esta opción el video solo existe en su formato base.
 */
export type FormatsOption = FormatName[] | Partial<Record<FormatName, FormatSize>>;

export const isFormatName = (v: unknown): v is FormatName => typeof v === 'string' && (FORMAT_NAMES as readonly string[]).includes(v);

/** Formato que corresponde a un tamaño: más ancho que alto = horizontal, más alto que ancho = vertical, igual = cuadrado. */
export function formatOf(width: number, height: number): FormatName {
  return width > height ? 'horizontal' : width < height ? 'vertical' : 'cuadrado';
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Tamaños derivados del tamaño base (`width` x `height` de `defineVideo`): con el lado largo L y el corto S,
 * horizontal = L x S, vertical = S x L, cuadrado = S x S (1920x1080 da 1080x1920 y 1080x1080). El formato
 * del propio tamaño base se queda exactamente con ese tamaño. Si el base es cuadrado, el lado largo es S x 16/9.
 */
export function deriveFormatSizes(width: number, height: number): Record<FormatName, FormatSize> {
  const S = Math.min(width, height);
  const L = width === height ? even((S * 16) / 9) : Math.max(width, height);
  const all: Record<FormatName, FormatSize> = {
    horizontal: { width: L, height: S },
    vertical: { width: S, height: L },
    cuadrado: { width: S, height: S },
  };
  all[formatOf(width, height)] = { width, height };
  return all;
}

/** Los tamaños tienen que ser pares: H.264 yuv420p no admite lados impares (ffmpeg los rellenaría con una fila negra sin avisar). */
export function assertEvenSize(where: string, size: FormatSize): void {
  for (const k of ['width', 'height'] as const) {
    if (size[k] % 2 !== 0) {
      const lo = size[k] - 1;
      throw new Error(`${where}: el tamaño ${size.width}x${size.height} tiene un lado impar (${k} = ${size[k]}); el video H.264 necesita lados pares. Usá ${k} = ${lo} o ${lo + 2}.`);
    }
  }
}

/** Tamaños de los formatos habilitados de un video (siempre incluye el formato base). Lanza un error claro si la opción no vale. */
export function resolveFormats(id: string, width: number, height: number, formats?: FormatsOption): Partial<Record<FormatName, FormatSize>> {
  const derived = deriveFormatSizes(width, height);
  const base = formatOf(width, height);
  const out: Partial<Record<FormatName, FormatSize>> = { [base]: { width, height } };
  if (formats === undefined) return out;
  const entries: [string, FormatSize | undefined][] = Array.isArray(formats)
    ? formats.map((n) => [n, undefined] as [string, FormatSize | undefined])
    : Object.entries(formats);
  for (const [name, size] of entries) {
    if (!isFormatName(name)) throw new Error(`defineVideo(${id}): formato desconocido "${name}" (los válidos son ${FORMAT_NAMES.join(', ')})`);
    const s = size ?? derived[name];
    for (const k of ['width', 'height'] as const) {
      if (!Number.isInteger(s[k]) || s[k] <= 0) throw new Error(`defineVideo(${id}): formats.${name}.${k} tiene que ser un entero positivo (recibido ${String(s[k])})`);
    }
    // El formato del tamaño base ya existe con `width` x `height`: listarlo con otro tamaño lo pisaría sin avisar.
    if (name === base && (s.width !== width || s.height !== height)) {
      throw new Error(`defineVideo(${id}): formats.${name} (${s.width}x${s.height}) es el formato del tamaño base (${width}x${height}) y no puede tener otro tamaño; cambiá width/height de defineVideo, o quitá "${name}" de formats.`);
    }
    assertEvenSize(`defineVideo(${id}): formats.${name}`, s);
    out[name] = { width: s.width, height: s.height };
  }
  return out;
}

/** Configuración del video en un formato (o en el base si no se indica). */
export function configFor(
  def: VideoConfig & { id?: string; formatSizes?: Partial<Record<FormatName, FormatSize>> },
  format?: FormatName,
): VideoConfig & { format: FormatName } {
  const { fps, durationInFrames } = def;
  if (format === undefined) return { fps, durationInFrames, width: def.width, height: def.height, format: formatOf(def.width, def.height) };
  const size = def.formatSizes?.[format];
  if (!size) {
    const have = Object.keys(def.formatSizes ?? { [formatOf(def.width, def.height)]: 1 }).join(', ');
    throw new Error(`El video${def.id ? ` "${def.id}"` : ""} no admite el formato "${format}" (disponibles: ${have}). Se habilitan con \`formats\` en defineVideo.`);
  }
  return { fps, durationInFrames, width: size.width, height: size.height, format };
}

/** Valor por formato para `useFormat().pick`: `horizontal` es obligatorio; lo que falte usa el de `horizontal`. */
export type FormatPick<T> = { horizontal: T; vertical?: T; cuadrado?: T };
