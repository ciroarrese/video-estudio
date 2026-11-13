import { checkDeterminism, createStage, scanAudio, getVideo, getVideos, waitForHolds, collectAudio } from '../index';
import type { DeterminismResult, Stage } from '../index';
import './videos';

type VideoMeta = { id: string; fps: number; width: number; height: number; durationInFrames: number };
/** JSON-safe track: `to` is null when unbounded (Infinity does not survive JSON). */
type WireTrack = { src: string; from: number; to: number | null; startFrom: number; volume: number };

declare global {
  interface Window {
    __ve: {
      ready: Promise<void>;
      videos: VideoMeta[];
      setFrame(n: number): Promise<void>;
      audio(): WireTrack[];
      scanAudio(): WireTrack[];
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
const videos = getVideos();
const meta: VideoMeta[] = videos.map(({ id, fps, width, height, durationInFrames }) => ({
  id, fps, width, height, durationInFrames,
}));

const videoId = params.get('video') ?? videos[0]?.id;
const def = videoId ? getVideo(videoId) : undefined;

let setupError: Error | null = null;
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

let stage: Stage | null = null;
if (!setupError && def) {
  try {
    stage = createStage(document.getElementById('stage')!, def, inputProps);
  } catch (e) {
    setupError = e as Error;
  }
}

const need = (): Stage => {
  if (!stage) throw setupError ?? new Error('stage not available');
  return stage;
};

const checkFrame = (s: Stage, n: number) => {
  const last = s.def.durationInFrames - 1;
  if (!Number.isInteger(n) || n < 0 || n > last) throw new RangeError(`setFrame: frame ${n} out of range [0, ${last}]`);
};

window.__ve = {
  videos: meta,
  ready: Promise.resolve().then(async () => {
    const s = need();
    s.render(0);
    await settle();
  }),
  async setFrame(n: number) {
    const s = need();
    checkFrame(s, n);
    s.render(n);
    await settle();
  },
  audio: () => wire(collectAudio()),
  scanAudio: () => wire(scanAudio(need())),
  checkDeterminism: (frames: number[]) => checkDeterminism(need(), frames, settle),
};
// Avoid an unhandled rejection if nobody awaits ready.
window.__ve.ready.catch(() => {});
