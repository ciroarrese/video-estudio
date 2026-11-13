// Metadatos de video, formatos y escenas: lo comparten render/ y qa/ (no depende de Chromium).
import type { FormatName, FormatSize, SceneInfo } from '../engine';

export const FORMATS: readonly FormatName[] = ['horizontal', 'vertical', 'cuadrado'];

/** Lo que el runtime informa de cada video (`__ve.videos`). */
export type VideoMeta = {
  id: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  /** Formato del tamaño base. */
  format?: FormatName;
  /** Tamaño de cada formato habilitado. */
  formats?: Partial<Record<FormatName, FormatSize>>;
  /** Carpeta de la que salió (`videos/<slug>`, `examples/<id>`). */
  source?: string | null;
};

export function parseFormat(v: string | undefined): FormatName | undefined {
  if (v === undefined) return undefined;
  if (!(FORMATS as readonly string[]).includes(v)) throw new Error(`--format debe ser ${FORMATS.join(', ')} (recibido "${v}")`);
  return v as FormatName;
}

/** Metadatos en el formato pedido (tamaño incluido). Sin formato, los del formato base. */
export function metaForFormat(meta: VideoMeta, format?: FormatName): VideoMeta & { format: FormatName } {
  const base = meta.format ?? (meta.width > meta.height ? 'horizontal' : meta.width < meta.height ? 'vertical' : 'cuadrado');
  if (!format) return { ...meta, format: base };
  const size = meta.formats?.[format] ?? (format === base ? { width: meta.width, height: meta.height } : undefined);
  if (!size) {
    const have = Object.keys(meta.formats ?? { [base]: 1 }).join(', ');
    throw new Error(`El video "${meta.id}" no admite el formato "${format}" (disponibles: ${have}). Se habilitan con \`formats\` en defineVideo.`);
  }
  return { ...meta, width: size.width, height: size.height, format };
}

/** Parámetros de la URL de la página runtime. */
export function pageQuery(videoId: string, props: Record<string, unknown>, format?: FormatName, opts: { allowMissingFonts?: boolean } = {}): string {
  return `?video=${encodeURIComponent(videoId)}${Object.keys(props).length ? `&props=${encodeURIComponent(JSON.stringify(props))}` : ''}${format ? `&format=${format}` : ''}${opts.allowMissingFonts ? '&fonts=warn' : ''}`;
}

/**
 * Escena por id/nombre o por índice (desde 0, como en `--list-scenes`). Un id que coincide exacto gana sobre el índice;
 * un nombre repetido es ambiguo y se pide el índice.
 */
export function resolveScene(scenes: SceneInfo[], key: string): SceneInfo & { index: number } {
  if (!scenes.length) throw new Error('Este video no tiene escenas con nombre (usá <Sequence name>, <Series.Item name>, `scenes` en defineVideo o composeStory).');
  const byId = scenes.map((s, index) => ({ ...s, index })).filter((s) => s.id === key || s.name === key);
  if (byId.length === 1) return byId[0]!;
  if (byId.length > 1) throw new Error(`La escena "${key}" está repetida en el video (índices ${byId.map((s) => s.index).join(', ')}); elegí una por índice con --scene <n>.`);
  if (/^\d+$/.test(key)) {
    const i = Number(key);
    if (i < scenes.length) return { ...scenes[i]!, index: i };
    throw new Error(`No hay escena con índice ${i} (hay ${scenes.length}: 0 a ${scenes.length - 1}).`);
  }
  throw new Error(`No existe la escena "${key}". Disponibles: ${scenes.map((s) => s.id).join(', ')}.`);
}

export const sceneRange = (s: SceneInfo): [number, number] => [s.from, s.from + s.durationInFrames - 1];

export function formatSceneList(id: string, scenes: SceneInfo[], fps: number): string {
  if (!scenes.length) return `${id}: sin escenas con nombre`;
  const rows = scenes.map((s, i) => `  ${String(i).padStart(2)}  ${s.id.padEnd(Math.max(...scenes.map((x) => x.id.length)))}  cuadros ${s.from}-${s.from + s.durationInFrames - 1} (${s.durationInFrames} = ${(s.durationInFrames / fps).toFixed(1)} s)${s.name && s.name !== s.id ? `  ${s.name}` : ''}`);
  return `${id}: ${scenes.length} escenas (--scene <id|índice>)\n${rows.join('\n')}`;
}

export function formatVideoList(metas: VideoMeta[]): string {
  const w = Math.max(2, ...metas.map((m) => m.id.length));
  return metas
    .map((m) => `${m.id.padEnd(w)}  ${m.width}x${m.height}@${m.fps}  ${m.durationInFrames} cuadros  formatos: ${Object.keys(m.formats ?? {}).join(', ') || m.format || '-'}${m.source ? `  (${m.source})` : ''}`)
    .join('\n');
}

/** Errores por carpeta de `__ve.loadErrors`, para imprimir después de la lista de videos. */
export function formatLoadErrors(errors: { folder: string; message: string }[]): string {
  return `Atención: ${errors.length === 1 ? 'una carpeta no cargó' : `${errors.length} carpetas no cargaron`} (los demás videos siguen disponibles):\n${errors.map((e) => `  - ${e.message.split('\n').join('\n    ')}`).join('\n')}`;
}
