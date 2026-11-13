import { describe, it, expect } from "vitest";
import { themeFromTokens, themeFromTokensWithReport, neutral } from "./index";

describe("themeFromTokens JSON", () => {
  it("lee forma W3C con $value", () => {
    const t = themeFromTokens({ color: { accent: { $value: "#ff0000" }, bg: { $value: "#101010" } } });
    expect(t.color.accent).toBe("#ff0000");
    expect(t.color.bg).toBe("#101010");
    expect(t.color.text).toBe(neutral.color.text);
  });
  it("lee forma plana y anidada", () => {
    const t = themeFromTokens({ color: { accent: "#00ff00", brand: { secondary: "#0000ff" } } });
    expect(t.color.accent).toBe("#00ff00");
    const t2 = themeFromTokens({ "color-accent": "#00ff00" });
    expect(t2.color.accent).toBe("#00ff00");
  });
  it("resuelve referencias {a.b}", () => {
    const t = themeFromTokens({ color: { base: "#123456", accent: { $value: "{color.base}" } } });
    expect(t.color.accent).toBe("#123456");
  });
  it("radios, sombras y fuente", () => {
    const t = themeFromTokens({
      "font-family": "Inter, sans-serif",
      radius: { sm: "0.25rem", md: 12 },
      shadow: { md: "0 2px 4px rgba(0,0,0,.2)" },
    });
    expect(t.font.family).toBe("Inter, sans-serif");
    expect(t.radius.sm).toBe(4);
    expect(t.radius.md).toBe(12);
    expect(t.shadow.md).toBe("0 2px 4px rgba(0,0,0,.2)");
  });
});

describe("themeFromTokens CSS", () => {
  const css = `:root{--color-primary:#e11d48;--color-background:hsl(0 0% 100%);--color-foreground:rgb(10,10,10);--color-error:#b00020;--font-family:"Inter",sans-serif;--radius-lg:24px;--shadow-sm:0 1px 1px #0003;}`;
  it("mapea alias", () => {
    const { theme, report } = themeFromTokensWithReport(css);
    expect(theme.color.accent).toBe("#e11d48");
    expect(theme.color.bg).toBe("hsl(0 0% 100%)");
    expect(theme.color.text).toBe("rgb(10,10,10)");
    expect(theme.color.danger).toBe("#b00020");
    expect(theme.font.family).toBe('"Inter",sans-serif');
    expect(theme.radius.lg).toBe(24);
    expect(report.mapped["color.accent"]).toBe("color-primary");
  });
  it("resuelve var()", () => {
    const t = themeFromTokens(":root{--brand:#112233;--color-accent:var(--brand)}");
    expect(t.color.accent).toBe("#112233");
  });
});

describe("report y fallback", () => {
  it("informa mapeados y fallback", () => {
    const { report } = themeFromTokensWithReport({ color: { accent: "#ff0000" } });
    expect(report.mapped["color.accent"]).toBe("color-accent");
    expect(report.fallback).toContain("color.bg");
    expect(report.fallback).not.toContain("color.accent");
    expect(report.derived).toContain("color.onAccent");
  });
  it("ignora colores inválidos con aviso", () => {
    const { theme, report } = themeFromTokensWithReport({ color: { accent: "not-a-color", bg: "#fff" } });
    expect(theme.color.accent).toBe(neutral.color.accent);
    expect(report.warnings.some((w) => w.includes("inválido"))).toBe(true);
    expect(report.fallback).toContain("color.accent");
    expect(theme.color.bg).toBe("#fff");
  });
  it("usa el tema base indicado", () => {
    const base = { ...neutral, name: "x", color: { ...neutral.color, text: "#222222" } };
    expect(themeFromTokens({}, base).color.text).toBe("#222222");
  });
  it("no muta el base", () => {
    const before = JSON.stringify(neutral);
    themeFromTokens({ color: { accent: "#000" } });
    expect(JSON.stringify(neutral)).toBe(before);
  });
});

import { contrastRatio, dark, parseColor } from "./index";

describe("revisión", () => {
  it("onAccent elige el mayor contraste en tonos medios", () => {
    for (const acc of ["#ff6a00", "#0099ff", "#808080"]) {
      const { theme, report } = themeFromTokensWithReport({ color: { accent: acc } });
      const best = Math.max(contrastRatio("#000000", acc), contrastRatio("#ffffff", acc));
      expect(contrastRatio(theme.color.onAccent, acc)).toBeCloseTo(best, 5);
      expect(theme.color.onAccent).toBe("#000000");
      expect(report.derived).toContain("color.onAccent");
    }
  });

  const css = `:root{--color-primary:#111111;--color-background:#ffffff}
  @media (prefers-color-scheme: dark){:root{--color-primary:#999999}}
  .dark{--color-primary:#eeeeee;--color-background:#000000}`;
  it("CSS: solo lee el primer :root por defecto", () => {
    const t = themeFromTokens(css);
    expect(t.color.accent).toBe("#111111");
    expect(t.color.bg).toBe("#ffffff");
  });
  it("CSS: selector .dark", () => {
    const t = themeFromTokens(css, neutral, { selector: ".dark" });
    expect(t.color.accent).toBe("#eeeeee");
    expect(t.color.bg).toBe("#000000");
  });
  it("CSS: @media solo si se pide", () => {
    const t = themeFromTokens(css, neutral, { selector: "@media (prefers-color-scheme: dark)" });
    expect(t.color.accent).toBe("#999999");
  });

  it("referencias sin resolver no se copian", () => {
    const { theme, report } = themeFromTokensWithReport(
      ":root{--font-family:var(--missing);--shadow-md:0 1px var(--s);--gradient-brand:var(--g)}",
    );
    const j = themeFromTokensWithReport({ shadow: { md: "{shadow.x}" } });
    expect(j.theme.shadow.md).toBe(neutral.shadow.md);
    expect(j.report.warnings.length).toBe(1);
    expect(theme.font.family).toBe(neutral.font.family);
    expect(theme.shadow.md).toBe(neutral.shadow.md);
    expect(theme.gradient.brand).toBe(neutral.gradient.brand);
    expect(report.warnings.length).toBeGreaterThanOrEqual(3);
    expect(report.fallback).toContain("font.family");
  });

  it("solo accent: deriva accent2, degradado y nubes", () => {
    const { theme, report } = themeFromTokensWithReport({ color: { accent: "#e11d48" } });
    expect(theme.color.accent2).not.toBe(neutral.color.accent2);
    expect(theme.gradient.brand).toContain("#e11d48");
    expect(theme.gradient.brand).toContain(theme.color.accent2);
    expect(theme.cloud.colors).not.toEqual(neutral.cloud.colors);
    expect(theme.cloud.colors[0]).toBe("#e11d48");
    expect(parseColor(theme.color.accent2)).not.toBeNull();
    expect(report.derived).toEqual(expect.arrayContaining(["color.accent2", "gradient.brand", "cloud.colors"]));
  });

  it("ambigüedad: exacto > semántico > escala, perdedores en report.ambiguous", () => {
    const { theme, report } = themeFromTokensWithReport({
      color: { danger: "#aa0000", error: "#bb0000", red: { "500": "#cc0000" } },
    });
    expect(theme.color.danger).toBe("#aa0000");
    expect(report.mapped["color.danger"]).toBe("color-danger");
    expect(report.ambiguous["color.danger"]).toEqual(["color-error", "color-red-500"]);
    const r2 = themeFromTokensWithReport({ color: { red: { "500": "#cc0000" }, error: "#bb0000" } });
    expect(r2.theme.color.danger).toBe("#bb0000");
    expect(r2.report.ambiguous["color.danger"]).toEqual(["color-red-500"]);
    // independiente del orden de las claves
    const r3 = themeFromTokensWithReport({ color: { error: "#bb0000", danger: "#aa0000" } });
    expect(r3.theme.color.danger).toBe("#aa0000");
  });

  it("temas base inmutables y resultado mutable", () => {
    expect(Object.isFrozen(neutral)).toBe(true);
    expect(Object.isFrozen(neutral.color.chart)).toBe(true);
    expect(Object.isFrozen(dark.motion.easing.out)).toBe(true);
    expect(dark.color).not.toBe(neutral.color);
    expect(dark.cloud.colors).not.toBe(neutral.cloud.colors);
    expect(dark.font).not.toBe(neutral.font);
    const t = themeFromTokens({ color: { accent: "#123456" } });
    expect(Object.isFrozen(t)).toBe(false);
    t.color.chart.push("#fff");
    t.font.weights.regular = 300;
    expect(neutral.font.weights.regular).toBe(400);
  });
});
