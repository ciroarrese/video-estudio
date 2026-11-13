import React from "react";
import { defineVideo } from "../engine";
import { ThemeProvider, dark, neutral } from "../themes";
import type { Theme } from "../themes";
import { composeStory } from "./compose";
import type { ComposeOptions } from "./compose";
import type { StorySpec, TopicScene } from "./types";

export type ThemeInput = "neutral" | "dark" | Theme;
export type StoryProps = { theme?: ThemeInput };

export const resolveTheme = (t: ThemeInput | undefined): Theme => (typeof t === "object" && t ? t : t === "dark" ? dark : neutral);

/** Registra la historia como video (`/?video=<id>&props={"theme":"dark"}`). */
export function defineStory({
  id, spec, scenes, fps = 30, width = 1920, height = 1080, theme = "neutral", ...opts
}: { id: string; spec: StorySpec; scenes: TopicScene[]; fps?: number; width?: number; height?: number; theme?: ThemeInput } & ComposeOptions) {
  const { component: Story, durationInFrames } = composeStory(spec, scenes, opts);
  const Video: React.FC<StoryProps> = ({ theme: t }) => (
    <ThemeProvider theme={resolveTheme(t ?? theme)}>
      <Story />
    </ThemeProvider>
  );
  return defineVideo<StoryProps>({ id, component: Video, fps, width, height, durationInFrames, defaultProps: { theme: typeof theme === "string" ? theme : "neutral" } });
}
