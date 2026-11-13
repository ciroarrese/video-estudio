import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral, dark } from "../themes";
import type { Theme } from "../themes";
import * as data from "./data";
import * as ui from "./ui";
import * as art from "./art";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 2000 };
const html = (node: React.ReactNode, theme: Theme, frame: number) =>
  renderToString(<FrameProvider frame={frame} config={config}><ThemeProvider theme={theme}>{node}</ThemeProvider></FrameProvider>);

const C = (n: number) => `rgb(${n}, ${n + 1}, ${n + 2})`;
const sentinel: Theme = {
  name: "sentinel",
  color: { bg: C(1), surface: C(11), surfaceAlt: C(21), text: C(31), textMuted: C(41), border: C(51), accent: C(61), accent2: C(71), onAccent: C(81), success: C(91), warning: C(101), danger: C(111), chart: [C(121), C(131)] },
  gradient: { brand: `linear-gradient(90deg, ${C(141)}, ${C(151)})` },
  font: { family: '"SentinelFont", serif', weights: { regular: 411, medium: 522, semibold: 633, stat: 744 } },
  radius: { sm: 7001, md: 7002, panel: 7003, lg: 7004, pill: 7005 },
  shadow: { sm: `0 0 0 3001px ${C(161)}`, md: `0 0 0 3002px ${C(171)}`, lg: `0 0 0 3003px ${C(181)}` },
  type: { hero: 1001, h1: 1002, h2: 1003, body: 1004, caption: 1005, eyebrow: 1006, stat: 1007 },
  safe: { x: 2001, y: 2002 },
  motion: { easing: { standard: [0.1, 0.2, 0.3, 0.4], out: [0.2, 0.3, 0.4, 0.5], inOut: [0.3, 0.4, 0.5, 0.6] }, duration: { fast: 3, base: 6, slow: 9 } },
  cloud: { colors: [C(191), C(201)], opacity: 0.77 },
};
const sentinelColors = [...Object.values(sentinel.color).flat(), ...sentinel.cloud.colors] as string[];
function strip(markup: string): string {
  let m = markup;
  for (const c of sentinelColors) {
    const [r, g, b] = c.match(/\d+/g)!;
    m = m.replace(new RegExp(`rgba\\(${r}, ${g}, ${b}, [0-9.]+\\)`, "g"), "");
    m = m.split(c).join("");
  }
  for (const v of [sentinel.gradient.brand, ...Object.values(sentinel.shadow)]) m = m.split(v).join("");
  return m;
}
function assertThemed(markup: string) {
  const rest = strip(markup);
  expect(rest).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(rest).not.toMatch(/rgba?\(|hsla?\(/);
  const styles = (rest.match(/(?:style|fill|stroke|stop-color)="[^"]*"/g) ?? []).join(" ");
  expect(styles.replace(/transparent|none/g, "")).not.toMatch(/\b(white|black|red|green|blue|gray|grey|orange|purple|pink|yellow|silver|navy|teal|cyan|magenta|brown|gold)\b/i);
  const radii = new Set(Object.values(sentinel.radius).map((r) => `${r}px`));
  for (const m of markup.matchAll(/border-radius:([^;"]+)/g)) expect(radii.has(m[1]!.trim()), `border-radius ${m[1]}`).toBe(true);
  const shadows = new Set(Object.values(sentinel.shadow));
  for (const m of markup.matchAll(/box-shadow:([^;"]+)/g)) expect(shadows.has(m[1]!.trim()), `box-shadow ${m[1]}`).toBe(true);
}

const D = 60;
const items: [string, (f: number) => React.ReactNode][] = [
  ["LineDraw", (f) => <data.LineDraw frame={f} duration={D} />],
  ["DonutRing", (f) => <data.DonutRing frame={f} duration={D} />],
  ["RadarMorph", (f) => <data.RadarMorph frame={f} duration={D} />],
  ["Bars3D", (f) => <data.Bars3D frame={f} duration={D} />],
  ["BarsGrow", (f) => <data.BarsGrow frame={f} duration={D} />],
  ["FlowSteps", (f) => <data.FlowSteps frame={f} duration={D} />],
  ["NotificationStack", (f) => <ui.NotificationStack frame={f} duration={D} />],
  ["ChatThread", (f) => <ui.ChatThread frame={f} duration={D} />],
  ["CommandPalette", (f) => <ui.CommandPalette frame={f} duration={D} />],
  ["CardFan", (f) => <ui.CardFan frame={f} duration={D} />],
  ["PhoneScroll", (f) => <ui.PhoneScroll frame={f} duration={D} />],
  ["PhoneFrame", (f) => <ui.PhoneFrame frame={f}>x</ui.PhoneFrame>],
  ["BeforeAfter", (f) => <ui.BeforeAfter frame={f} duration={D} />],
  ["TileGrid", (f) => <ui.TileGrid frame={f} duration={D} />],
  ["TileDone", (f) => <ui.TileDone frame={f} start={10} duration={30} />],
  ["BlueprintDraw", (f) => <art.BlueprintDraw frame={f} duration={D} />],
  ["MarkerDraw", (f) => <art.MarkerDraw frame={f} duration={D} kind="circle" />],
  ["PaperCollage", (f) => <art.PaperCollage frame={f} duration={D} />],
  ["ShapeMorph", (f) => <art.ShapeMorph frame={f} duration={D} />],
  ["DotWipe", (f) => <art.DotWipe frame={f} duration={D} />],
  ["HalftoneWave", (f) => <art.HalftoneWave frame={f} duration={D} />],
  ["PixelBuild", (f) => <art.PixelBuild frame={f} duration={D} />],
  ["LogoLand", (f) => <art.LogoLand frame={f} duration={D} />],
  ["LiquidBlob", (f) => <art.LiquidBlob frame={f} duration={D} />],
  ["SealSpin", (f) => <art.SealSpin frame={f} duration={D} />],
  ["RibbonTwist", (f) => <art.RibbonTwist frame={f} duration={D} />],
];

describe("fx data/ui/art components", () => {
  for (const [name, mk] of items) {
    it(`${name}: renders at 0, mid and last in both themes`, () => {
      for (const t of [neutral, dark]) for (const f of [0, 20, 30, 59, 60, 200]) expect(() => html(mk(f), t, f)).not.toThrow();
    });
    it(`${name}: no hard-coded colours (sentinel theme)`, () => {
      for (const f of [0, 15, 30, 45, 100]) assertThemed(html(mk(f), sentinel, f));
    });
    it(`${name}: pure (A then B equals fresh B) and last frame is still`, () => {
      const a = html(mk(10), neutral, 10);
      expect(a).toBeTruthy();
      expect(html(mk(40), neutral, 40)).toBe(html(mk(40), neutral, 40));
      expect(html(mk(100), neutral, 100)).toBe(html(mk(500), neutral, 500));
    });
  }
  it("sentinel colours show up", () => {
    const out = html(<data.BarsGrow frame={100} />, sentinel, 100);
    expect(out).toContain(C(121));
    expect(out).toContain("SentinelFont");
  });
});
