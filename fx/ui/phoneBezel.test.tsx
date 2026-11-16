import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../../engine";
import { ThemeProvider, dark, editorial, neutral, papel, relativeLuminance } from "../../themes";
import type { Theme } from "../../themes";
import { PhoneFrame, PhoneScroll, phoneBodyColor } from "./index";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 300 };
const html = (node: React.ReactNode, theme: Theme) =>
  renderToStaticMarkup(<FrameProvider frame={100} config={config}><ThemeProvider theme={theme}>{node}</ThemeProvider></FrameProvider>);

describe("PhoneFrame: color del marco", () => {
  it("por defecto es el de siempre: el más oscuro entre texto y fondo", () => {
    for (const t of [neutral, dark, editorial, papel]) {
      const body = relativeLuminance(t.color.text) <= relativeLuminance(t.color.bg) ? t.color.text : t.color.bg;
      expect(phoneBodyColor(t)).toBe(body);
      expect(phoneBodyColor(t, "auto")).toBe(body);
      expect(phoneBodyColor(t, "dark")).toBe(body);
      expect(html(<PhoneFrame width={380} height={760}>x</PhoneFrame>, t)).toContain(`background:${body}`);
    }
  });
  it("`light` y `soft` y los roles salen del tema", () => {
    expect(phoneBodyColor(neutral, "light")).toBe(neutral.color.bg);
    expect(phoneBodyColor(dark, "light")).toBe(dark.color.text);
    expect(phoneBodyColor(neutral, "accent")).toBe(neutral.color.accent);
    expect(phoneBodyColor(neutral, "border")).toBe(neutral.color.border);
    const soft = phoneBodyColor(papel, "soft");
    expect(soft).not.toBe(phoneBodyColor(papel));
    expect(relativeLuminance(soft)).toBeGreaterThan(relativeLuminance(phoneBodyColor(papel)));
  });
  it("el marco cambia con bezelColor y también en PhoneScroll", () => {
    const a = html(<PhoneFrame width={380} height={760} bezelColor="accent">x</PhoneFrame>, neutral);
    expect(a).toContain(`background:${neutral.color.accent}`);
    expect(html(<PhoneScroll width={380} height={760} bezelColor="accent" />, neutral)).toContain(`background:${neutral.color.accent}`);
  });
});
