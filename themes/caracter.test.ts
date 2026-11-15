import { describe, expect, it } from "vitest";
import { dark, editorial, mergeStyleInput, neon, neutral, papel, resolveStyle, resolveTheme, styleIssues, themeCharacter, inferCharacter, themeFromTokens, DESIGN_CHARACTERS } from "./index";

describe("carácter declarado del design system", () => {
  it("sin declarar (auto) la heurística decide, como antes", () => {
    expect([neutral, dark, editorial, neon, papel].map(themeCharacter)).toEqual(["geometrico-sobrio", "tecnico-oscuro", "editorial", "tecnico-oscuro", "ludico-manual"]);
    for (const t of [neutral, dark, editorial, neon, papel]) expect(resolveStyle(t).decor.character).toBe("auto");
  });
  it("un tema que lo declara manda sobre la heurística", () => {
    const t = { ...neutral, style: mergeStyleInput(neutral.style, { decor: { character: "editorial" as const } }) };
    expect(themeCharacter(t)).toBe("editorial");
    expect(inferCharacter(t)).toBe("geometrico-sobrio");
    for (const c of DESIGN_CHARACTERS) expect(themeCharacter({ ...neutral, style: { decor: { character: c } } })).toBe(c);
  });
  it("un valor inválido falla con un mensaje claro", () => {
    expect(styleIssues({ decor: { character: "barroco" } })[0]!.accepted).toContain("editorial");
  });
  it("se declara por token (--style-decor-character)", () => {
    const t = themeFromTokens(":root{--style-decor-character: ludico-manual; --color-bg: #ffffff; --color-text: #111111;}");
    expect(themeCharacter(t)).toBe("ludico-manual");
  });
});

describe("deriva de las nubes (style.background.drift)", () => {
  it("por defecto 1 (el de siempre) y acepta 0 a 4", () => {
    expect(resolveStyle(neutral).background.drift).toBe(1);
    expect(styleIssues({ background: { drift: 3 } })).toEqual([]);
    expect(styleIssues({ background: { drift: 5 } }).length).toBe(1);
    expect(resolveTheme({ ...neutral, style: { background: { drift: 2 } } }).style.background.drift).toBe(2);
  });
  it("se declara por token", () => {
    const t = themeFromTokens(":root{--style-background-drift: 2.5; --color-bg: #ffffff; --color-text: #111111;}");
    expect(resolveStyle(t).background.drift).toBe(2.5);
  });
});
