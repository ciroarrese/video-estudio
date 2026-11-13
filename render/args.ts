import { parseArgs } from 'node:util';
import type { FormatName } from '../engine';
import { parseFormat } from './meta';

export type CliOptions = {
  videoId: string;
  out?: string;
  props: Record<string, unknown>;
  frames?: [number, number];
  concurrency?: number;
  scale: number;
  crf: number;
  segment: number;
  audio: boolean;
  cache: boolean;
  keepFrames: boolean;
  frameFormat: 'png' | 'jpeg';
  jpegQuality: number;
  check: boolean;
  checkMaxDelta: number;
  checkMaxRatio: number;
  checkStrict: boolean;
  assets: string[];
  format?: FormatName;
  scene?: string;
  list: boolean;
  listScenes: boolean;
  help: boolean;
};

export const USAGE = `Uso: ve-render <videoId> [opciones]
       ve-render --list                      (videos descubiertos: examples/* y videos/*)
       ve-render <videoId> --list-scenes     (escenas con nombre del video)

  --out <archivo>        Salida (por defecto out/<id>.mp4)
  --props '<json>'       Props (objeto JSON) que se mezclan con defaultProps
  --frames a-b           Solo ese rango de cuadros (inclusive)
  --format <f>           horizontal, vertical o cuadrado (el video tiene que admitirlo; ver defineVideo({ formats }))
  --scene <id|indice>    Solo esa escena (indice desde 0, como en --list-scenes); no se combina con --frames
  --list                 Lista los videos disponibles con su tamaño y formatos
  --list-scenes          Lista las escenas con nombre del video y sus cuadros
  --concurrency N        Paginas en paralelo (por defecto min(cpus, 6))
  --scale N              Escala de salida, p. ej. 0.5 o 2 (por defecto 1)
  --crf N                Calidad x264, 0-51 (por defecto 18)
  --segment N            Cuadros por parte en cache (por defecto 150)
  --no-audio             No mezclar audio
  --no-cache             Ignorar y reescribir la cache de partes
  --keep-frames          Conservar los PNG junto a la salida
  --frame-format png|jpeg  Formato de captura (png sin perdida, por defecto; jpeg mas rapido)
  --jpeg-quality N       Calidad JPEG 1-100 (por defecto 95)
  --assets <dir>         Directorio extra con archivos estaticos y de audio (repetible)
  --check                Verificar determinismo en vez de codificar (tolerante por defecto)
  --check-max-delta N    Con --check: maxima diferencia por canal tolerada (por defecto 2)
  --check-max-ratio R    Con --check: fraccion maxima de pixeles distintos (por defecto 0.001 = 0.1%)
  --check-strict         Con --check: comparacion byte a byte
  -h, --help             Esta ayuda
`;

const int = (name: string, v: string, min: number): number => {
  if (!/^-?\d+$/.test(v)) throw new Error(`${name} debe ser un entero (recibido "${v}")`);
  const n = Number(v);
  if (n < min) throw new Error(`${name} debe ser >= ${min} (recibido ${n})`);
  return n;
};

export function parseCliArgs(argv: string[]): CliOptions {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        out: { type: 'string' },
        props: { type: 'string' },
        frames: { type: 'string' },
        concurrency: { type: 'string' },
        scale: { type: 'string' },
        crf: { type: 'string' },
        segment: { type: 'string' },
        'no-audio': { type: 'boolean' },
        'no-cache': { type: 'boolean' },
        'keep-frames': { type: 'boolean' },
        'frame-format': { type: 'string' },
        'jpeg-quality': { type: 'string' },
        check: { type: 'boolean' },
        'check-max-delta': { type: 'string' },
        'check-max-ratio': { type: 'string' },
        'check-strict': { type: 'boolean' },
        assets: { type: 'string', multiple: true },
        format: { type: 'string' },
        scene: { type: 'string' },
        list: { type: 'boolean' },
        'list-scenes': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (e) {
    throw new Error((e as Error).message);
  }
  const { values: v, positionals } = parsed;
  if (v.help) {
    return { videoId: '', props: {}, scale: 1, crf: 18, segment: 150, audio: true, cache: true, keepFrames: false, frameFormat: 'png', jpegQuality: 95, check: false, checkMaxDelta: 2, checkMaxRatio: 0.001, checkStrict: false, assets: [], list: false, listScenes: false, help: true };
  }
  if (v.list) {
    if (positionals.length) throw new Error('--list no lleva <videoId>');
    return { videoId: '', props: {}, scale: 1, crf: 18, segment: 150, audio: true, cache: true, keepFrames: false, frameFormat: 'png', jpegQuality: 95, check: false, checkMaxDelta: 2, checkMaxRatio: 0.001, checkStrict: false, assets: [], list: true, listScenes: false, help: false };
  }
  if (positionals.length !== 1) throw new Error('Falta <videoId> (o sobran argumentos posicionales)');

  const format = parseFormat(v.format);
  if (v.scene !== undefined && v.scene === '') throw new Error('--scene necesita un id o un índice');
  if (v.scene !== undefined && v.frames !== undefined) throw new Error('--scene y --frames no se combinan: --scene ya fija el rango de cuadros');
  let props: Record<string, unknown> = {};
  if (v.props !== undefined) {
    let p: unknown;
    try {
      p = JSON.parse(v.props);
    } catch (e) {
      throw new Error(`--props no es JSON valido: ${(e as Error).message}`);
    }
    if (p === null || typeof p !== 'object' || Array.isArray(p)) throw new Error('--props debe ser un objeto JSON');
    props = p as Record<string, unknown>;
  }

  let frames: [number, number] | undefined;
  if (v.frames !== undefined) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(v.frames);
    if (!m) throw new Error(`--frames debe ser "a-b" o "a" (recibido "${v.frames}")`);
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (b < a) throw new Error(`--frames: el final (${b}) es menor que el inicio (${a})`);
    frames = [a, b];
  }

  let scale = 1;
  if (v.scale !== undefined) {
    scale = Number(v.scale);
    if (!Number.isFinite(scale) || scale <= 0 || scale > 8) throw new Error(`--scale debe estar en (0, 8] (recibido "${v.scale}")`);
  }
  const crf = v.crf === undefined ? 18 : int('--crf', v.crf, 0);
  if (crf > 51) throw new Error('--crf debe estar entre 0 y 51');

  const frameFormat = v['frame-format'] ?? 'png';
  if (frameFormat !== 'png' && frameFormat !== 'jpeg') throw new Error(`--frame-format debe ser png o jpeg (recibido "${frameFormat}")`);
  const jpegQuality = v['jpeg-quality'] === undefined ? 95 : int('--jpeg-quality', v['jpeg-quality'], 1);
  if (jpegQuality > 100) throw new Error('--jpeg-quality debe estar entre 1 y 100');

  const checkMaxDelta = v['check-max-delta'] === undefined ? 2 : int('--check-max-delta', v['check-max-delta'], 0);
  let checkMaxRatio = 0.001;
  if (v['check-max-ratio'] !== undefined) {
    checkMaxRatio = Number(v['check-max-ratio']);
    if (!Number.isFinite(checkMaxRatio) || checkMaxRatio < 0 || checkMaxRatio > 1) throw new Error(`--check-max-ratio debe estar en [0, 1] (recibido "${v['check-max-ratio']}")`);
  }

  return {
    videoId: positionals[0]!,
    out: v.out,
    props,
    frames,
    concurrency: v.concurrency === undefined ? undefined : int('--concurrency', v.concurrency, 1),
    scale,
    crf,
    segment: v.segment === undefined ? 150 : int('--segment', v.segment, 1),
    audio: !v['no-audio'],
    cache: !v['no-cache'],
    keepFrames: !!v['keep-frames'],
    frameFormat,
    jpegQuality,
    check: !!v.check,
    checkMaxDelta,
    checkMaxRatio,
    checkStrict: !!v['check-strict'],
    assets: v.assets ?? [],
    format,
    scene: v.scene,
    list: false,
    listScenes: !!v['list-scenes'],
    help: false,
  };
}
