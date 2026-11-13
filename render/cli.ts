import { parseCliArgs, USAGE } from './args';
import { installSignalHandlers, isInterrupted } from './cleanup';
import { checkVideo, discoverVideos, listScenes, renderVideo } from './render';
import { budgetFromScenes, formatStoryBudget } from '../stories/budget';
import { formatLoadErrors, formatSceneList, formatVideoList } from './meta';

installSignalHandlers();

async function main(): Promise<number> {
  let o;
  try {
    o = parseCliArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`Error: ${(e as Error).message}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    console.log(USAGE);
    return 0;
  }
  const log = (m: string) => console.log(m);
  const base = {
    videoId: o.videoId, out: o.out, props: o.props, frames: o.frames, concurrency: o.concurrency, scale: o.scale,
    crf: o.crf, segment: o.segment, audio: o.audio, cache: o.cache, keepFrames: o.keepFrames, frameFormat: o.frameFormat, jpegQuality: o.jpegQuality, assets: o.assets, allowMissingFonts: o.allowMissingFonts || undefined, checkCount: o.checkCount, checkPerScene: o.checkPerScene, checkAll: o.checkAll, checkMaxDelta: o.checkMaxDelta, checkMaxRatio: o.checkMaxRatio, checkStrict: o.checkStrict, format: o.format, scene: o.scene, log,
  };
  try {
    if (o.list) {
      const { videos, errors } = await discoverVideos({ log });
      console.log(formatVideoList(videos));
      if (errors.length) console.log(`\n${formatLoadErrors(errors)}`);
      return 0;
    }
    if (o.listScenes) {
      const r = await listScenes(base);
      console.log(formatSceneList(r.meta.id, r.scenes, r.meta.fps));
      // si es una historia (defineStory), el presupuesto de cuadros por bloque (igual que `qa`)
      const budget = budgetFromScenes(r.scenes, r.meta.fps);
      if (budget) console.log(`\n${formatStoryBudget(budget)}`);
      return 0;
    }
    if (o.check || o.checkStrict) {
      const r = await checkVideo(base);
      console.log(r.ok ? `check: OK (determinista; ${r.frames.length} cuadros verificados)` : `check: FALLO (no determinista; ${r.frames.length} cuadros verificados)`);
      return r.ok ? 0 : 1;
    }
    await renderVideo(base);
    return 0;
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    return 1;
  }
}

const code = await main();
// A signal handler is closing the browser: let it finish and exit with 128+signal.
if (isInterrupted()) await new Promise(() => {});
process.exit(code);
