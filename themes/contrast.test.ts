import { describe, it, expect } from "vitest";
import { contrastRatio, relativeLuminance, checkTheme, neutral, dark } from "./index";

describe("contraste", () => {
  it("negro/blanco = 21", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });
  it("mismo color = 1", () => {
    expect(contrastRatio("#777", "#777")).toBeCloseTo(1, 5);
  });
  it("valor conocido #767676 sobre blanco ~4.54", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
  });
  it("luminancia blanca = 1", () => {
    expect(relativeLuminance("rgb(255,255,255)")).toBeCloseTo(1, 5);
  });
  it("neutral y dark pasan", () => {
    expect(checkTheme(neutral)).toEqual([]);
    expect(checkTheme(dark)).toEqual([]);
  });
  it("avisa cuando falla", () => {
    const bad = { ...neutral, color: { ...neutral.color, textMuted: "#cccccc" } };
    const w = checkTheme(bad);
    expect(w.map((x) => x.pair)).toContain("textMuted/bg");
  });
});

describe("contraste: alfa y umbral", () => {
  it("compone el texto translúcido sobre el fondo", () => {
    // negro al 50% sobre blanco = #808080 sobre blanco
    expect(contrastRatio("rgba(0,0,0,0.5)", "#ffffff")).toBeCloseTo(contrastRatio("#808080", "#ffffff"), 1);
    expect(contrastRatio("rgba(0,0,0,0)", "#ffffff")).toBeCloseTo(1, 5);
  });
  it("umbral sRGB 0.04045", () => {
    // 10/255 = 0.0392 <= 0.04045 => lineal (rama /12.92)
    expect(relativeLuminance("#0a0a0a")).toBeCloseTo(10 / 255 / 12.92, 6);
  });
});
