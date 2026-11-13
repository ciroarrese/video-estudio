import { checkFontFailures, checkDeterminism, describeAtPoint, createStage, scanAudio, getVideo, getVideos, waitForHolds, collectAudio, resolveScenes, isFormatName, FORMAT_NAMES, formatOf } from '../index';
import type { DeterminismResult, FormatName, FormatSize, SceneInfo, Stage } from '../index';
import { videosReady } from './videos';
import type { LoadError } from './discover';

/** `formats`: tamaño de cada formato habilitado; `format`: el que corresponde a width x height (el base). `source`: carpeta de la que salió. */
type VideoMeta = { id: string; fps: number; width: number; height: number; durationInFrames: number; format: FormatName; formats: Partial<Record<FormatName, FormatSize>>; source: string | null };
/** JSON-safe track: `to` is null when unbounded (Infinity does not survive JSON). */
type WireTrack = { src: string; from: number; to: number | null; startFrom: number; volume: number };

declare global {
  interface Window {
    __ve: {
      ready: Promise<void>;
      readonly videos: VideoMeta[];
      /** Mensajes de las carpetas que no cargaron (id repetido, archivo roto), uno por línea; null si todo cargó. Solo informa: el video pedido falla únicamente si es uno de los afectados. */
      readonly loadError: string | null;
      /** Lo mismo, por carpeta: `{folder, folders, ids, message}`. */
      readonly loadErrors: LoadError[];
      setFrame(n: number): Promise<void>;
      audio(): WireTrack[];
      scanAudio(): Promise<WireTrack[]>;
      /** Escenas del video (declaradas o juntadas de `<Sequence name>`). */
      scenes(): Promise<SceneInfo[]>;
      checkDeterminism(frames: number[]): Promise<DeterminismResult[]>;
      /** Muestra el cuadro `n` y devuelve, para cada punto `[x, y]` (px del escenario), los elementos que hay ahí (de arriba hacia abajo; ver `describeAtPoint`). Para diagnosticar `--check`. */
      describeAt(n: number, points: [number, number][]): Promise<string[][]>;
    };
  }
}

const nextFrames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });

const params = new URLSearchParams(location.search);
// `?fonts=warn` (--allow-missing-fonts / VE_ALLOW_MISSING_FONTS=1): una fuente que no carga solo avisa (borradores).
const allowMissingFonts = params.get('fonts') === 'warn';
// `?nostage=1`: solo registra los videos (lista y carpeta de origen), sin dibujar nada. El render lo usa para saber de qué carpeta
// es el video (y qué carpetas de estáticos servir) antes de que la página pida fuentes o imágenes.
const noStage = params.get('nostage') === '1';

const settle = async () => {
  await document.fonts.ready;
  await waitForHolds();
  await nextFrames(2);
  // Una fuente que no cargó haría salir el video con otra tipografía sin avisar: es un error de render (salvo borrador).
  checkFontFailures(allowMissingFonts);
};

const wire = (tracks: ReturnType<typeof collectAudio>): WireTrack[] =>
  tracks.map((t) => ({ ...t, to: Number.isFinite(t.to) ? t.to : null }));

let meta: VideoMeta[] = [];
let loadErrors: LoadError[] = [];
let setupError: Error | null = null;
let stage: Stage | null = null;

// `window.__ve` existe desde el primer momento (la página puede leerlo apenas carga); todo lo que depende de que las
// carpetas de video hayan cargado espera a `init`, que nunca rechaza (los errores quedan en `setupError`).
const init = (async () => {
  loadErrors = await videosReady;
  const videos = getVideos();
  meta = videos.map(({ id, fps, width, height, durationInFrames, formatSizes, source }) => ({
    id, fps, width, height, durationInFrames, format: formatOf(width, height), formats: formatSizes ?? { [formatOf(width, height)]: { width, height } }, source: source ?? null,
  }));
  const videoId = params.get('video') ?? videos[0]?.id;
  const def = videoId ? getVideo(videoId) : undefined;

  // Una carpeta rota o un id repetido solo afecta al video pedido si es uno de los comprometidos.
  const involved = def ? loadErrors.filter((e) => e.ids.includes(def.id)) : [];
  if (involved.length) setupError = new Error(involved.map((e) => e.message).join('\n'));
  let inputProps: object = {};
  const propsParam = params.get('props');
  if (propsParam) {
    try {
      const parsed = JSON.parse(propsParam);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('must be a JSON object');
      inputProps = parsed;
    } catch (e) {
      setupError = new Error(`Invalid &props= query parameter (${(e as Error).message})`);
    }
  }
  if (!setupError && !def) {
    // Si hay carpetas con errores, el video pedido puede ser justamente uno que no cargó: se las muestra.
    setupError = new Error(`Unknown video "${videoId}". Available: ${meta.map((m) => m.id).join(', ')}${loadErrors.length ? `\nCarpetas con errores (puede ser una de ellas):\n${loadErrors.map((e) => e.message).join('\n')}` : ''}`);
  }
  let format: FormatName | undefined;
  const formatParam = params.get('format');
  if (!setupError && formatParam) {
    if (isFormatName(formatParam)) format = formatParam;
    else setupError = new Error(`Formato desconocido "${formatParam}" (los válidos son ${FORMAT_NAMES.join(', ')})`);
  }
  if (!setupError && def && !noStage) {
    try {
      stage = createStage(document.getElementById('stage')!, def, inputProps, format);
    } catch (e) {
      setupError = e as Error;
    }
  }
})();

const need = (): Stage => {
  if (!stage) throw setupError ?? new Error('stage not available');
  return stage;
};

const checkFrame = (s: Stage, n: number) => {
  const last = s.def.durationInFrames - 1;
  if (!Number.isInteger(n) || n < 0 || n > last) throw new RangeError(`setFrame: frame ${n} out of range [0, ${last}]`);
};

window.__ve = {
  get videos() {
    return meta;
  },
  get loadError() {
    return loadErrors.length ? loadErrors.map((e) => e.message).join('\n') : null;
  },
  get loadErrors() {
    return loadErrors;
  },
  ready: init.then(async () => {
    if (noStage) return;
    const s = need();
    s.render(0);
    await settle();
  }),
  async setFrame(n: number) {
    await init;
    const s = need();
    checkFrame(s, n);
    s.render(n);
    await settle();
  },
  audio: () => wire(collectAudio()),
  scanAudio: async () => (await init, wire(scanAudio(need()))),
  scenes: async () => (await init, resolveScenes(need())),
  describeAt: async (n: number, points: [number, number][]) => {
    await init;
    const s = need();
    checkFrame(s, n);
    s.render(n);
    await settle();
    const host = document.getElementById('stage')!;
    return points.map(([x, y]) => describeAtPoint(host, x, y));
  },
  checkDeterminism: async (frames: number[]) => (await init, checkDeterminism(need(), frames, settle)),
};
// Avoid an unhandled rejection if nobody awaits ready.
window.__ve.ready.catch(() => {});
