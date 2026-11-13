import { describe, it, expect } from "vitest";
import { contrastRatio, relativeLuminance, checkTheme, neutral, dark, themeFromTokensWithReport } from "./index";

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

describe("checkTheme: estados, acentos y gráfico", () => {
  const roles = ["success", "warning", "danger"] as const;
  const bgs = ["bg", "surface", "surfaceAlt"] as const;
  for (const th of [neutral, dark]) {
    it(`${th.name}: estados >= 4.5 sobre bg, surface y surfaceAlt`, () => {
      for (const r of roles) for (const b of bgs) {
        expect(contrastRatio(th.color[r], th.color[b])).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${th.name}: acentos >= 4.5 y chart >= 3 sobre surface`, () => {
      for (const r of ["accent", "accent2"] as const)
        for (const b of ["bg", "surface"] as const)
          expect(contrastRatio(th.color[r], th.color[b])).toBeGreaterThanOrEqual(4.5);
      for (const col of th.color.chart) expect(contrastRatio(col, th.color.surface)).toBeGreaterThanOrEqual(3);
    });
  }
  it("avisa estados, acento y gráfico con severidad", () => {
    const bad = { ...neutral, color: { ...neutral.color, success: "#7fd6a4", accent2: "#ffffff", chart: ["#ffffff", "#aaaaaa"] } };
    const w = checkTheme(bad);
    const pairs = w.map((x) => x.pair);
    expect(pairs).toContain("success/surface");
    expect(pairs).toContain("accent2/bg");
    expect(pairs).toContain("chart[0]/surface");
    expect(w.find((x) => x.pair === "accent2/surface")!.severity).toBe("error");
    expect(w.find((x) => x.pair === "chart[1]/surface")!.severity).toBe("error");
  });
  it("themeFromTokensWithReport incluye estos avisos", () => {
    const { report } = themeFromTokensWithReport({ color: { success: "#7fd6a4", "chart-1": "#ffffff" } });
    expect(report.warnings.some((x) => x.includes("success/surface"))).toBe(true);
    expect(report.warnings.some((x) => x.includes("chart[0]/surface"))).toBe(true);
  });
});
