import React from "react";
import { defineVideo } from "../engine";
import type { FormatsOption } from "../engine";
import { ThemeProvider, dark, neutral } from "../themes";
import type { Theme } from "../themes";
import { composeStory } from "./compose";
import type { ComposeOptions } from "./compose";
import type { StorySpec, TopicScene } from "./types";

export type ThemeInput = "neutral" | "dark" | Theme;
export type StoryProps = { theme?: ThemeInput };

export const resolveTheme = (t: ThemeInput | undefined): Theme => (typeof t === "object" && t ? t : t === "dark" ? dark : neutral);

/**
 * Registra la historia como video (`/?video=<id>&props={"theme":"dark"}`). Por defecto solo el formato base: cada formato extra
 * (`formats: ["vertical", "cuadrado"]`) obliga a que las escenas de tema tengan su propio diseño (`useFormat()`), así que se pide a propósito.
 */
export function defineStory({
  id, spec, scenes, fps = 30, width = 1920, height = 1080, theme = "neutral", formats, ...opts
}: { id: string; spec: StorySpec; scenes: TopicScene[]; fps?: number; width?: number; height?: number; theme?: ThemeInput; formats?: FormatsOption } & ComposeOptions) {
  const { component: Story, durationInFrames, timeline } = composeStory(spec, scenes, opts);
  // Cada bloque (apertura, temas, vueltas, cierre) es una escena: `--scene <id|índice>` y `--list-scenes`.
  const sceneList = timeline.map((e) => ({ id: e.id, name: e.kind === "topic" ? spec.topics.find((t) => t.id === e.id)?.name : undefined, from: e.from, durationInFrames: e.durationInFrames }));
  const Video: React.FC<StoryProps> = ({ theme: t }) => (
    <ThemeProvider theme={resolveTheme(t ?? theme)}>
      <Story />
    </ThemeProvider>
  );
  return defineVideo<StoryProps>({ id, component: Video, fps, width, height, durationInFrames, formats, scenes: sceneList, defaultProps: { theme: typeof theme === "string" ? theme : "neutral" } });
}
