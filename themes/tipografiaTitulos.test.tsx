import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { DockedHeadline, ThemeScope } from "../kit";
import { fontFaceCss } from "../kit/fonts";
import { ThemeProvider, checkTheme, dark, editorial, neon, neutral, papel, textStyle, themeFromTokensWithReport, titleFamily, titleFont } from "./index";
import type { Theme } from "./index";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 300 };
const html = (node: React.ReactNode, theme: Theme) =>
  renderToStaticMarkup(<FrameProvider frame={100} config={config}><ThemeProvider theme={theme}>{node}</ThemeProvider></FrameProvider>);

describe("font.display: tipografía de los títulos", () => {
  it("sin font.display nada cambia: los títulos usan la familia del texto", () => {
    for (const t of [neutral, dark, editorial, neon, papel]) {
      expect(titleFamily(t)).toBe(t.font.family);
      expect(titleFont(t)).toEqual({});
      expect(textStyle(t, "title").fontFamily).toBeUndefined();
      expect(html(<DockedHeadline index={1} title="Hola" />, t)).not.toMatch(/font-family/);
    }
  });

  it("con font.display, textStyle('title') y el titular usan esa familia; label, eyebrow y caption no", () => {
    const t: Theme = { ...neutral, font: { ...neutral.font, display: '"Titulos", serif' } };
    expect(titleFamily(t)).toBe('"Titulos", serif');
    expect(titleFont(t)).toEqual({ fontFamily: '"Titulos", serif' });
    expect(textStyle(t, "title").fontFamily).toBe('"Titulos", serif');
    for (const r of ["label", "eyebrow", "caption"] as const) expect(textStyle(t, r).fontFamily).toBeUndefined();
    expect(html(<DockedHeadline index={1} title="Hola" subtitle="apoyo" />, t)).toContain("Titulos");
  });

  it("fromTokens la toma de --font-family-display (y alias) y la hereda el tema derivado", () => {
    const r = themeFromTokensWithReport(`:root { --color-primary: #0a5; --font-family: "Texto", sans-serif; --font-family-display: "Titulos", serif; }`);
    expect(r.theme.font.family).toBe('"Texto", sans-serif');
    expect(r.theme.font.display).toBe('"Titulos", serif');
    expect(r.report.mapped["font.display"]).toBeDefined();
    const r2 = themeFromTokensWithReport(`:root { --font-heading: Georgia, serif; }`);
    expect(r2.theme.font.display).toBe("Georgia, serif");
    const derivado = themeFromTokensWithReport(`:root { --color-primary: #a05; }`, r.theme);
    expect(derivado.theme.font.display).toBe('"Titulos", serif');
  });

  it("--font-display: swap (una propiedad de @font-face) no cuenta como familia", () => {
    const r = themeFromTokensWithReport(`:root { --font-display: swap; }`);
    expect(r.theme.font.display).toBeUndefined();
  });

  it("sin tokens de títulos, el reporte y el tema son los de siempre", () => {
    const r = themeFromTokensWithReport(`:root { --color-primary: #0a5; }`);
    expect(r.theme.font.display).toBeUndefined();
    expect(r.report.fallback).not.toContain("font.display");
  });

  it("checkTheme valida font.display y displayFiles", () => {
    expect(checkTheme({ ...neutral, font: { ...neutral.font, display: "Titulos, serif" } }).filter((w) => w.pair.startsWith("font."))).toEqual([]);
    expect(checkTheme({ ...neutral, font: { ...neutral.font, display: "  " } }).map((w) => w.pair)).toContain("font.display");
    expect(checkTheme({ ...neutral, font: { ...neutral.font, display: "12px" } }).map((w) => w.pair)).toContain("font.display");
    expect(checkTheme({ ...neutral, font: { ...neutral.font, displayFiles: [{ weight: 400, src: "/t.woff2" }] } }).map((w) => w.pair)).toContain("font.displayFiles");
  });

  it("las fuentes de displayFiles declaran su @font-face con la familia de los títulos", () => {
    const t: Theme = { ...neutral, font: { ...neutral.font, family: '"Texto", sans-serif', files: [{ weight: 400, src: "/t.woff2" }], display: '"Titulos", serif', displayFiles: [{ weight: 700, src: "/h.woff2" }] } };
    const css = fontFaceCss(t);
    expect(css).toContain('font-family:"Texto"');
    expect(css).toContain('font-family:"Titulos";font-weight:700;src:url("/h.woff2")');
  });
});

describe("ThemeScope: tipografía sin paint", () => {
  const otra: Theme = { ...neutral, font: { ...neutral.font, family: '"Otra", serif' } };
  it("por defecto no agrega nada (como siempre)", () => {
    expect(html(<ThemeScope theme={otra}><i>x</i></ThemeScope>, neutral)).toBe("<i>x</i>");
  });
  it("con `font` aplica la familia del tema del ámbito en un contenedor que no cambia la maquetación", () => {
    const s = html(<ThemeScope theme={otra} font><i>x</i></ThemeScope>, neutral);
    expect(s).toContain("display:contents");
    expect(s).toContain("Otra");
    expect(s).not.toContain("background");
  });
});
