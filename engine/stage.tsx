import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { FrameProvider } from './FrameProvider';
import { clearAudio, collectAudio, type AudioTrack } from './Audio';
import type { RegisteredVideo } from './defineVideo';
import { configFor, type FormatName } from './format';
import type { VideoConfig } from './config';

export type Stage = {
  def: RegisteredVideo<any>;
  /** Configuración con la que se dibuja (tamaño y formato elegidos). */
  config: VideoConfig;
  /** Synchronously render frame n (reuses the same React root). */
  render(n: number): void;
  /** Unmount everything (root renders null). */
  blank(): void;
  /** Frame currently shown, or null when blank / nothing rendered yet. */
  current(): number | null;
  html(): string;
  /** Contenido de los `<canvas>` del escenario (dataURL), para comparar cuadros dibujados en lienzo. Vacio si no hay. */
  canvasData?(): string;
  destroy(): void;
};

export function createStage(host: HTMLElement, def: RegisteredVideo<any>, inputProps: object = {}, format?: FormatName): Stage {
  const config = configFor(def, format);
  Object.assign(host.style, {
    position: 'relative',
    width: `${config.width}px`,
    height: `${config.height}px`,
    overflow: 'hidden',
  });
  const root = createRoot(host);
  const Comp = def.component;
  const props = { ...(def.defaultProps ?? {}), ...inputProps };
  let cur: number | null = null;
  return {
    def,
    config,
    render(n) {
      flushSync(() => {
        root.render(
          <FrameProvider frame={n} config={config}>
            <Comp {...props} />
          </FrameProvider>,
        );
      });
      cur = n;
    },
    blank() {
      flushSync(() => root.render(null));
      cur = null;
    },
    current: () => cur,
    html: () => host.innerHTML,
    canvasData: () =>
      Array.from(host.querySelectorAll('canvas'))
        // Si un canvas no se puede leer (por ejemplo, contaminado), `toDataURL` lanza: checkDeterminism lo informa como falla.
        .map((c) => c.toDataURL())
        .join('|'),
    destroy() {
      root.unmount();
      cur = null;
    },
  };
}

const scanCache = new WeakMap<Stage, AudioTrack[]>();

/**
 * Render every frame once and return all audio tracks. Cached per stage (a stage is tied to one
 * video + props, so a new stage invalidates it). Restores the frame that was shown before.
 */
export function scanAudio(stage: Stage): AudioTrack[] {
  const cached = scanCache.get(stage);
  if (cached) return cached;
  const prev = stage.current();
  stage.blank();
  clearAudio();
  for (let n = 0; n < stage.def.durationInFrames; n++) stage.render(n);
  const result = collectAudio();
  scanCache.set(stage, result);
  stage.blank();
  if (prev !== null) stage.render(prev);
  return result;
}
