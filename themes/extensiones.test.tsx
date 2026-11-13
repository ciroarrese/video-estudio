import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ThemeProvider, checkTheme, dark, neutral, resolveColor, resolveTheme, suggestShade, themeFromTokens, themeFromTokensWithReport, useTheme,
} from "./index";
import type { Theme } from "./index";

const TOKENS = `:root {
  --color-primary: #d0006f;
  --color-background: #f7f7f8;
  --color-surface: #ffffff;
  --data-estado-ok: #1b7a47;
  --data-estado-bajo: #f0f0a0;
  --severidad-1: #e0b400;
}`;

describe("theme.data", () => {
  it("se declara desde tokens y se lee con useTheme().data", () => {
    const { theme, report } = themeFromTokensWithReport(TOKENS, neutral, {
      data: { estadoOk: { min: 4.5 }, estadoBajo: { on: ["bg", "surface"] }, sev1: "severidad-1", literal: { color: "#123456" } },
    });
    expect(theme.data.estadoOk).toBe("#1b7a47");
    expect(theme.data.sev1).toBe("#e0b400");
    expect(theme.data.literal).toBe("#123456");
    expect(report.data.estadoOk).toMatchObject({ color: "#1b7a47", source: "data-estado-ok", on: ["surface"], min: 4.5 });
    expect(report.mapped["data.sev1"]).toBe("severidad-1");
    let seen = "";
    const Probe = () => {
      seen = useTheme().data.estadoOk!;
      return null;
    };
    renderToString(<ThemeProvider theme={theme}><Probe /></ThemeProvider>);
    expect(seen).toBe("#1b7a47");
  });

  it("un nombre que no existe lanza un error claro con los declarados", () => {
    const theme = themeFromTokens(TOKENS, neutral, { data: { estadoOk: {} } });
    expect(() => theme.data.noExiste).toThrow(/no hay un color de datos "noExiste".*Declarados: estadoOk/);
    expect(() => neutral.data.cualquiera).toThrow(/No hay ninguno declarado/);
    expect(JSON.stringify(theme.data)).toBe('{"estadoOk":"#1b7a47"}');
    expect("noExiste" in theme.data).toBe(false);
  });

  it("un token que falta o un color inválido no declaran el nombre y avisan", () => {
    const { theme, report } = themeFromTokensWithReport(TOKENS, neutral, { data: { falta: "no-hay", malo: { color: "nope" }, "con-guion": { color: "#fff" } } });
    expect(Object.keys(theme.data)).toEqual([]);
    expect(report.warnings.filter((w) => /falta|malo|con-guion/.test(w))).toHaveLength(3);
  });

  it("entra en checkTheme contra las superficies declaradas", () => {
    const { theme, report } = themeFromTokensWithReport(TOKENS, neutral, { data: { estadoBajo: { on: ["bg", "surface"], min: 4.5 }, estadoOk: {} } });
    const w = checkTheme(theme).filter((x) => x.pair.startsWith("data."));
    expect(w.map((x) => x.pair)).toEqual(["data.estadoBajo/bg", "data.estadoBajo/surface"]);
    expect(w[0]!.severity).toBe("error");
    expect(report.warnings.some((x) => x.includes("data.estadoBajo/bg"))).toBe(true);
  });

  it("hereda de la base y funciona dentro de ThemeScope (themes anidados)", () => {
    const base = themeFromTokens(TOKENS, neutral, { data: { estadoOk: {} } });
    const hijo = themeFromTokens("--data-estado-ok: #4cd08a;", { ...dark, data: base.data, dataChecks: base.dataChecks }, { data: { estadoOk: {} } });
    expect(hijo.data.estadoOk).toBe("#4cd08a");
    const spread: Theme = { ...base, name: "copia" };
    expect(resolveTheme(spread).data.estadoOk).toBe("#1b7a47");
    expect(() => resolveTheme({ ...neutral, data: undefined }).data.x).toThrow(/"x"/);
  });

  it("resolveColor acepta roles, data.<nombre>, chart[n] y colores; si no, lanza", () => {
    const t = themeFromTokens(TOKENS, neutral, { data: { estadoOk: {} } });
    expect(resolveColor(t, "accent")).toBe(t.color.accent);
    expect(resolveColor(t, "data.estadoOk")).toBe("#1b7a47");
    expect(resolveColor(t, "chart[1]")).toBe(t.color.chart[1]);
    expect(resolveColor(t, "#abcdef")).toBe("#abcdef");
    expect(() => resolveColor(t, "marron")).toThrow(/no es un rol del tema/);
    expect(() => resolveColor(t, "data.otro")).toThrow(/otro/);
  });
});

describe("type.ui", () => {
  it("los temas base traen la subescala y un tema sin ella la recibe al usarse", () => {
    expect(neutral.type.ui).toEqual({ xs: 15, sm: 20, md: 24 });
    expect(dark.type.ui.sm).toBe(20);
    const sinUi: Theme = { ...neutral, type: { hero: 1, h1: 2, h2: 3, body: 4, caption: 5, eyebrow: 6, stat: 7 } };
    expect(resolveTheme(sinUi).type.ui.md).toBe(24);
  });
  it("se mapea desde tokens", () => {
    const t = themeFromTokens("--type-ui-xs: 16px; --type-ui-md: 1.5rem;");
    expect(t.type.ui).toEqual({ xs: 16, sm: 20, md: 24 });
  });
});

describe("nubes desde tokens", () => {
  it("lista de colores, cantidad, opacidad, semilla y manchas", () => {
    const { theme, report } = themeFromTokensWithReport(`:root {
      --color-primary: #d0006f; --color-secondary: #f56406;
      --cloud-color-1: #d0006f; --cloud-color-2: #f56406; --cloud-color-3: #770ce9;
      --cloud-count: 4; --cloud-opacity: 22%; --cloud-seed: marca;
      --cloud-blob-1: 0.1 0.2 800; --cloud-blob-2: 0.9 0.8;
    }`);
    expect(theme.cloud.colors).toEqual(["#d0006f", "#f56406", "#770ce9"]);
    expect(theme.cloud.count).toBe(4);
    expect(theme.cloud.opacity).toBeCloseTo(0.22);
    expect(theme.cloud.seed).toBe("marca");
    expect(theme.cloud.blobs).toEqual([{ x: 0.1, y: 0.2, size: 800 }, { x: 0.9, y: 0.8 }]);
    expect(report.derived).not.toContain("cloud.colors");
  });
  it("también como lista separada por comas, y sin tokens se deriva de los acentos", () => {
    const a = themeFromTokens("--cloud-colors: #111111, rgb(1, 2, 3), nope;");
    expect(a.cloud.colors).toEqual(["#111111", "rgb(1, 2, 3)"]);
    const b = themeFromTokensWithReport("--color-primary: #d0006f;");
    expect(b.report.derived).toContain("cloud.colors");
  });
  it("valores fuera de rango se ignoran con aviso", () => {
    const { theme, report } = themeFromTokensWithReport("--cloud-count: 99; --cloud-opacity: 3; --cloud-blob-1: 2 2;");
    expect(theme.cloud.count).toBeUndefined();
    expect(theme.cloud.opacity).toBe(neutral.cloud.opacity);
    expect(report.warnings.length).toBeGreaterThanOrEqual(3);
  });
});

describe("informe de contraste accionable", () => {
  const marca = themeFromTokens("--color-primary: #e7007e; --color-background: #f7f7f8; --color-surface: #ffffff; --color-warning: #f5a623;");

  it("dice dónde se usa el par y sugiere el tono más cercano que pasa", () => {
    const w = checkTheme(marca);
    const acc = w.find((x) => x.pair === "accent/bg")!;
    expect(acc.usedBy!.join(" ")).toMatch(/GradientText/);
    expect(acc.usedBy!.join(" ")).toMatch(/DockedHeadline/);
    expect(acc.suggestion).toMatch(/^#[0-9a-f]{6}$/);
    expect(acc.message).toContain("Tono más cercano que pasa");
    const warn = w.find((x) => x.pair === "warning/bg")!;
    expect(warn.severity).toBe("error");
    expect(warn.suggestion).toBeDefined();
  });

  it("la sugerencia realmente pasa y conserva el matiz", () => {
    const s = suggestShade("#e7007e", "#f7f7f8", 4.5)!;
    expect(s).toBeDefined();
    const w = checkTheme({ ...marca, color: { ...marca.color, accent: s } });
    expect(w.find((x) => x.pair === "accent/bg")).toBeUndefined();
    expect(suggestShade("#777777", "#777777", 21)).toBeUndefined();
  });

  it("acknowledge baja el par a nota sin esconderlo", () => {
    const { theme, report } = themeFromTokensWithReport("--color-primary: #e7007e; --color-background: #f7f7f8;", neutral, { acknowledge: ["accent/bg"] });
    expect(theme.acknowledge).toEqual(["accent/bg"]);
    const n = checkTheme(theme).find((x) => x.pair === "accent/bg")!;
    expect(n.severity).toBe("note");
    expect(n.acknowledged).toBe(true);
    expect(report.notes.some((x) => x.includes("accent/bg"))).toBe(true);
    expect(report.warnings.some((x) => x.includes("accent/bg"))).toBe(false);
    expect(checkTheme({ ...theme, acknowledge: ["no/existe"] }).some((x) => x.pair === "no/existe" && x.severity === "note")).toBe(true);
  });
  it("acknowledge heredado queda atado a los colores: un derivado con otro par lo pierde y lo dice", () => {
    const marca = themeFromTokensWithReport("--color-primary: #e7007e; --color-background: #f7f7f8;", neutral, { acknowledge: ["accent/bg"] }).theme;
    expect(marca.acknowledgePins?.["accent/bg"]).toEqual(["#e7007e", "#f7f7f8"]);
    // mismo par de colores: sigue reconocido
    const igual = themeFromTokensWithReport("--color-text: #111111;", marca).theme;
    expect(checkTheme(igual).find((x) => x.pair === "accent/bg")?.severity).toBe("note");
    // sub-tema oscuro: accent/bg es otro par y no pasa: aviso o error, con el reconocimiento vencido nombrado
    const oscuro = themeFromTokensWithReport("--color-background: #3a0a24;", marca);
    const w = checkTheme(oscuro.theme).find((x) => x.pair === "accent/bg")!;
    expect(w.severity).not.toBe("note");
    expect(w.acknowledged).toBeUndefined();
    expect(w.message).toContain("ya no corresponde");
    expect(oscuro.report.warnings.some((x) => x.includes("accent/bg"))).toBe(true);
  });

  it("un reconocimiento vencido cuyo par hoy pasa sale como aviso aparte", () => {
    const marca = themeFromTokensWithReport("--color-primary: #e7007e; --color-background: #f7f7f8;", neutral, { acknowledge: ["accent/bg"] }).theme;
    const pasa = { ...marca, color: { ...marca.color, bg: "#ffffff", accent: "#000000" } };
    const w = checkTheme(pasa).filter((x) => x.pair === "accent/bg");
    expect(w).toHaveLength(1);
    expect(w[0]!.severity).toBe("warning");
    expect(w[0]!.message).toContain("ya no corresponde");
  });

  it("las manchas de nube aceptan el valor con y sin comillas", () => {
    const { theme, report } = themeFromTokensWithReport(`--cloud-blob-1: "0.1 0.2 800"; --cloud-blob-2: '0.9, 0.8'; --cloud-blob-3: 0.5 0.5 300;`);
    expect(theme.cloud.blobs).toEqual([{ x: 0.1, y: 0.2, size: 800 }, { x: 0.9, y: 0.8 }, { x: 0.5, y: 0.5, size: 300 }]);
    expect(report.warnings.filter((w) => w.includes("nube"))).toEqual([]);
  });

  it("type.display: valores por defecto y tokens", () => {
    expect(resolveTheme(neutral).type.display).toEqual({ sm: 48, md: 56, lg: 64 });
    const { theme } = themeFromTokensWithReport("--type-display-md: 60px;");
    expect(resolveTheme(theme).type.display).toEqual({ sm: 48, md: 60, lg: 64 });
  });
});
