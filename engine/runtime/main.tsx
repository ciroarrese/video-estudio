import { checkDeterminism, createStage, scanAudio, getVideo, getVideos, waitForHolds, collectAudio, resolveScenes, isFormatName, FORMAT_NAMES, formatOf } from '../index';
import type { DeterminismResult, FormatName, FormatSize, SceneInfo, Stage } from '../index';
import { videosReady } from './videos';

/** `formats`: tamaño de cada formato habilitado; `format`: el que corresponde a width x height (el base). `source`: carpeta de la que salió. */
type VideoMeta = { id: string; fps: number; width: number; height: number; durationInFrames: number; format: FormatName; formats: Partial<Record<FormatName, FormatSize>>; source: string | null };
/** JSON-safe track: `to` is null when unbounded (Infinity does not survive JSON). */
type WireTrack = { src: string; from: number; to: number | null; startFrom: number; volume: number };

declare global {
  interface Window {
    __ve: {
      ready: Promise<void>;
      readonly videos: VideoMeta[];
      /** Mensaje si falló la carga de las carpetas de video (id repetido, archivo roto); null si todo cargó. */
      readonly loadError: string | null;
      setFrame(n: number): Promise<void>;
      audio(): WireTrack[];
      scanAudio(): Promise<WireTrack[]>;
      /** Escenas del video (declaradas o juntadas de `<Sequence name>`). */
      scenes(): Promise<SceneInfo[]>;
      checkDeterminism(frames: number[]): Promise<DeterminismResult[]>;
    };
  }
}

const nextFrames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });

const settle = async () => {
  await document.fonts.ready;
  await waitForHolds();
  await nextFrames(2);
};

const wire = (tracks: ReturnType<typeof collectAudio>): WireTrack[] =>
  tracks.map((t) => ({ ...t, to: Number.isFinite(t.to) ? t.to : null }));

const params = new URLSearchParams(location.search);

let meta: VideoMeta[] = [];
let loadError: Error | null = null;
let setupError: Error | null = null;
let stage: Stage | null = null;

// `window.__ve` existe desde el primer momento (la página puede leerlo apenas carga); todo lo que depende de que las
// carpetas de video hayan cargado espera a `init`, que nunca rechaza (los errores quedan en `setupError`).
const init = (async () => {
  try {
    await videosReady;
  } catch (e) {
    loadError = e as Error;
  }
  const videos = getVideos();
  meta = videos.map(({ id, fps, width, height, durationInFrames, formatSizes, source }) => ({
    id, fps, width, height, durationInFrames, format: formatOf(width, height), formats: formatSizes ?? { [formatOf(width, height)]: { width, height } }, source: source ?? null,
  }));
  const videoId = params.get('video') ?? videos[0]?.id;
  const def = videoId ? getVideo(videoId) : undefined;

  setupError = loadError;
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
    setupError = new Error(`Unknown video "${videoId}". Available: ${meta.map((m) => m.id).join(', ')}`);
  }
  let format: FormatName | undefined;
  const formatParam = params.get('format');
  if (!setupError && formatParam) {
    if (isFormatName(formatParam)) format = formatParam;
    else setupError = new Error(`Formato desconocido "${formatParam}" (los válidos son ${FORMAT_NAMES.join(', ')})`);
  }
  if (!setupError && def) {
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
    return loadError ? loadError.message : null;
  },
  ready: init.then(async () => {
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
  checkDeterminism: async (frames: number[]) => (await init, checkDeterminism(need(), frames, settle)),
};
// Avoid an unhandled rejection if nobody awaits ready.
window.__ve.ready.catch(() => {});
