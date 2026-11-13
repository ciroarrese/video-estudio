import React from "react";
import { useFrame } from "../../engine";
import { ThemeProvider, dark, neutral, useTheme } from "../../themes";
import type { Theme } from "../../themes";
import { Cursor, Stage } from "../../kit";
import { BarsGrow, Bars3D, DonutRing, FlowSteps, LineDraw, RadarMorph } from "../../fx/data";
import { BeforeAfter, CardFan, ChatThread, CommandPalette, NotificationStack, PhoneScroll, TileDone, TileGrid } from "../../fx/ui";
import { wipeFraction } from "../../fx/art";
import { BlueprintDraw, DotWipe, HalftoneWave, LiquidBlob, LogoLand, MarkerDraw, PaperCollage, PixelBuild, RibbonTwist, SealSpin, ShapeMorph } from "../../fx/art";

/** `theme`: "neutral" | "dark" (por defecto neutral); tambien acepta un objeto Theme (para pruebas). */
export type FxDataUiArtProps = { theme?: "neutral" | "dark" | Theme };

export const SEGMENT = 90;
export const ANIM = 75;
type Entry = { name: string; group: string; w: number; h: number; render: (f: number, w: number, h: number) => React.ReactNode };

const D = ANIM - 5;
const entries: Entry[] = [
  { group: "data", name: "LineDraw", w: 900, h: 520, render: (f, w, h) => <LineDraw frame={f} width={w} height={h} duration={D} /> },
  { group: "data", name: "DonutRing", w: 520, h: 520, render: (f, w, h) => <DonutRing frame={f} width={w} height={h} duration={D} /> },
  { group: "data", name: "RadarMorph", w: 640, h: 560, render: (f, w, h) => <RadarMorph frame={f} width={w} height={h} duration={D} /> },
  { group: "data", name: "Bars3D", w: 900, h: 560, render: (f, w, h) => <Bars3D frame={f} width={w} height={h} duration={D} /> },
  { group: "data", name: "BarsGrow", w: 900, h: 520, render: (f, w, h) => <BarsGrow frame={f} width={w} height={h} duration={D} /> },
  { group: "data", name: "FlowSteps", w: 1100, h: 620, render: (f, w, h) => <FlowSteps frame={f} width={w} height={h} duration={D} /> },
  { group: "ui", name: "NotificationStack", w: 760, h: 560, render: (f, w, h) => <NotificationStack frame={f} width={w} height={h} duration={D} /> },
  { group: "ui", name: "ChatThread", w: 760, h: 560, render: (f, w, h) => <ChatThread frame={f} width={w} height={h} duration={D} /> },
  { group: "ui", name: "CommandPalette", w: 900, h: 560, render: (f, w, h) => <CommandPalette frame={f} width={w} height={h} duration={D} /> },
  { group: "ui", name: "CardFan", w: 900, h: 560, render: (f, w, h) => <CardFan frame={f} width={w} height={h} duration={D} /> },
  { group: "ui", name: "PhoneFrame + PhoneScroll", w: 380, h: 760, render: (f, w, h) => <PhoneScroll frame={f} width={w} height={h} duration={D} /> },
  { group: "ui", name: "BeforeAfter", w: 900, h: 560, render: (f, w, h) => <BeforeAfter frame={f} width={w} height={h} duration={D} /> },
  { group: "ui", name: "TileGrid", w: 900, h: 560, render: (f, w, h) => <TileGrid frame={f} width={w} height={h} duration={D} /> },
  {
    group: "ui", name: "TileDone + Cursor", w: 520, h: 170,
    render: (f, w, h) => (
      <div style={{ position: "relative", width: w, height: h }}>
        <TileDone frame={f} start={38} duration={28} width={w} height={h} />
        <Cursor frame={f} keys={[[6, w + 120, h + 120], [34, 70, h / 2 + 6]]} clicks={[38]} show={[6, 86]} />
      </div>
    ),
  },
  { group: "art", name: "BlueprintDraw", w: 900, h: 560, render: (f, w, h) => <BlueprintDraw frame={f} width={w} height={h} duration={D} /> },
  {
    group: "art", name: "MarkerDraw", w: 560, h: 520,
    render: (f, w) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <MarkerDraw frame={f} width={w} height={160} duration={30} kind="highlight" text="resaltar" />
        <MarkerDraw frame={f - 20} width={w} height={160} duration={30} kind="underline" text="subrayar" />
        <MarkerDraw frame={f - 40} width={w} height={160} duration={30} kind="circle" text="encerrar" />
      </div>
    ),
  },
  { group: "art", name: "PaperCollage", w: 900, h: 560, render: (f, w, h) => <PaperCollage frame={f} width={w} height={h} duration={D} /> },
  { group: "art", name: "ShapeMorph", w: 520, h: 520, render: (f, w, h) => <ShapeMorph frame={f} width={w} height={h} duration={D} /> },
  {
    group: "art", name: "DotWipe", w: 1920, h: 1080,
    render: (f, w, h) => <DotWipeDemo f={f} w={w} h={h} />,
  },
  { group: "art", name: "HalftoneWave", w: 900, h: 560, render: (f, w, h) => <HalftoneWave frame={f} width={w} height={h} duration={D} /> },
  { group: "art", name: "PixelBuild", w: 900, h: 360, render: (f, w, h) => <PixelBuild frame={f} width={w} height={h} duration={D} /> },
  { group: "art", name: "LogoLand", w: 520, h: 520, render: (f, w, h) => <LogoLand frame={f} width={w} height={h} duration={D} /> },
  { group: "art", name: "LiquidBlob", w: 900, h: 560, render: (f, w, h) => <LiquidBlob frame={f} width={w} height={h} duration={D} /> },
  { group: "art", name: "SealSpin", w: 520, h: 520, render: (f, w, h) => <SealSpin frame={f} width={w} height={h} duration={D} /> },
  { group: "art", name: "RibbonTwist", w: 900, h: 560, render: (f, w, h) => <RibbonTwist frame={f} width={w} height={h} duration={D} /> },
];

export const TOTAL = entries.length * SEGMENT;

function DotWipeDemo({ f, w, h }: { f: number; w: number; h: number }) {
  const theme = useTheme();
  const scene = f < (ANIM - 5) * 0.5 ? "Escena A" : "Escena B";
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: theme.type.h1, fontWeight: theme.font.weights.stat, color: wipeFraction("inout", f / (ANIM - 5)) > 0.6 ? theme.color.onAccent : theme.color.text }}>{scene}</div>
      <DotWipe frame={f} width={w} height={h} duration={ANIM - 5} mode="inout" />
    </div>
  );
}

function Scene() {
  const frame = useFrame();
  const theme = useTheme();
  const idx = Math.min(entries.length - 1, Math.floor(frame / SEGMENT));
  const local = Math.min(frame - idx * SEGMENT, SEGMENT - 1);
  const e = entries[idx]!;
  const scale = e.w >= 1920 ? 1 : Math.min(1.5, 1500 / e.w, 800 / e.h);
  return (
    <Stage clouds={false}>
      <div style={{ position: "absolute", left: 90, top: 56, display: "flex", alignItems: "baseline", gap: 18 }}>
        <span style={{ fontSize: theme.type.caption, fontWeight: theme.font.weights.semibold, color: theme.color.text }}>{e.name}</span>
        <span style={{ fontSize: theme.type.eyebrow * 0.8, color: theme.color.textMuted }}>{`fx/${e.group} · ${idx + 1}/${entries.length}`}</span>
      </div>
      <div style={{ position: "absolute", left: e.w >= 1920 ? 0 : 960 - (e.w * scale) / 2, top: e.w >= 1920 ? 0 : 570 - (e.h * scale) / 2, width: e.w, height: e.h, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        {e.render(local, e.w, e.h)}
      </div>
    </Stage>
  );
}

export function FxDataUiArt({ theme = "neutral" }: FxDataUiArtProps) {
  return (
    <ThemeProvider theme={typeof theme === "object" ? theme : theme === "dark" ? dark : neutral}>
      <Scene />
    </ThemeProvider>
  );
}
