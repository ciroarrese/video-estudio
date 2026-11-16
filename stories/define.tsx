import React from "react";
import { defineVideo } from "../engine";
import type { FormatsOption } from "../engine";
import { ThemeProvider, dark, editorial, neon, neutral, papel } from "../themes";
import type { Theme } from "../themes";
import { composeStory } from "./compose";
import { checkStoryFit, formatFitReport, registerStoryFit } from "./fit";
import { SubtitleLayer, subtitleReserve } from "./subtitles";
import type { StorySubtitles } from "./subtitles";
import type { ComposeOptions } from "./compose";
import type { StorySpec, TopicScene } from "./types";

/** Los design systems con nombre: `neutral` y `dark` (los de siempre) y los de ejemplo `editorial`, `neon` y `papel`. */
export type ThemeInput = "neutral" | "dark" | "editorial" | "neon" | "papel" | Theme;
export type StoryProps = { theme?: ThemeInput };

const NAMED: Record<string, Theme> = { neutral, dark, editorial, neon, papel };
export const resolveTheme = (t: ThemeInput | undefined): Theme => (typeof t === "object" && t ? t : (t && NAMED[t]) || neutral);

/**
 * Registra la historia como video (`/?video=<id>&props={"theme":"dark"}`). Por defecto solo el formato base: cada formato extra
 * (`formats: ["vertical", "cuadrado"]`) obliga a que las escenas de tema tengan su propio diseño (`useFormat()`), así que se pide a propósito.
 */
export function defineStory({
  id, spec, scenes, fps = 30, width = 1920, height = 1080, theme = "neutral", formats, fitCheck = true, subtitles, ...opts
}: { id: string; spec: StorySpec; scenes: (TopicScene | null)[]; fps?: number; width?: number; height?: number; theme?: ThemeInput; formats?: FormatsOption;
  /** Avisa en la consola (una vez por formato) si un nombre, una bajada o el título no entran en el área segura sin bajar del piso legible (`checkStoryFit`). `false` lo apaga. Solo avisa: no cambia lo que se dibuja. */
  fitCheck?: boolean;
  /**
   * Subtítulos de todo el video (ver `StorySubtitles`): se dibujan con `kit/Subtitles` por encima de la historia y la lista, el cartel de la apertura, los paneles y la firma del
   * cierre dejan libre su franja (`subtitleBand`) en cada formato; `story-fit` y `checkStoryFit` miden con ese espacio de menos. Las escenas de tema usan `useSubtitleBand()` para no pisarla.
   */
  subtitles?: StorySubtitles } & ComposeOptions) {
  const { component: Story, durationInFrames, timeline } = composeStory(spec, scenes, opts);
  // Cada bloque (apertura, temas, vueltas, cierre) es una escena: `--scene <id|índice>` y `--list-scenes`.
  const sceneList = timeline.map((e) => ({ id: e.id, name: e.kind === "topic" && e.topic !== undefined ? spec.topics[e.topic]?.name : undefined, from: e.from, durationInFrames: e.durationInFrames }));
  const Video: React.FC<StoryProps> = ({ theme: t }) => (
    <ThemeProvider theme={resolveTheme(t ?? theme)}>
      {subtitles ? <SubtitleLayer subtitles={subtitles}><Story /></SubtitleLayer> : <Story />}
    </ThemeProvider>
  );
  const reg = defineVideo<StoryProps>({ id, component: Video, fps, width, height, durationInFrames, formats, scenes: sceneList, // con un objeto `Theme` no se publica como prop (no es serializable): `t ?? theme` lo usa; `--props '{"theme":"dark"}'` lo pisa
    defaultProps: typeof theme === "string" ? { theme } : {} });
  // Largos de nombres, bajadas y título por formato: `qa` lo pide desde la página (regla `story-fit`) y, al componer, se avisa por consola (con el tema por defecto del video).
  const fitOf = (format: string, themeName?: ThemeInput) => {
    const size = reg.formatSizes?.[format as keyof typeof reg.formatSizes];
    if (!size) return null;
    const th = resolveTheme(themeName ?? theme);
    const r = checkStoryFit(spec, th, size, { width, height }, subtitleReserve(th, size, subtitles));
    // con el nombre del formato (`cuadrado`), no con su tamaño, en los mensajes
    return { ...r, format, issues: r.issues.map((i) => ({ ...i, message: i.message.replace(`Formato ${r.format}`, `Formato ${format}`) })) };
  };
  registerStoryFit(id, (format, themeName) => fitOf(format, themeName as ThemeInput | undefined));
  if (fitCheck) {
    const warn = () => {
      for (const format of Object.keys(reg.formatSizes ?? {})) for (const m of formatFitReport(fitOf(format)!)) if (typeof console !== "undefined") console.warn(`aviso (${id}): ${m}`);
    };
    // en el navegador la medida real necesita las fuentes cargadas; fuera de él (pruebas, Node) se mide con la estimación por glifo
    if (typeof document !== "undefined" && document.fonts?.ready) void document.fonts.ready.then(warn, () => {});
    else warn();
  }
  return reg;
}
