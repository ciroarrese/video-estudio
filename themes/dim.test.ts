import { describe, expect, it } from "vitest";
import { contrastRatio, dark, dimOpacity, dimmedColor, editorial, neon, neutral, papel } from "./index";
import { mixColors } from "./color";

describe("dimOpacity", () => {
  it("es lo más bajo que todavía llega al contraste pedido (y un paso menos no llega)", () => {
    for (const t of [neutral, dark, editorial, neon, papel]) {
      const fg = t.color.text, bg = t.color.surface;
      for (const min of [3, 4.5]) {
        const a = dimOpacity(fg, bg, { min });
        expect(contrastRatio(mixColors(bg, fg, a), bg)).toBeGreaterThanOrEqual(min);
        if (a > 0.01) expect(contrastRatio(mixColors(bg, fg, a - 0.01), bg)).toBeLessThan(min);
      }
    }
  });
  it("sube con el contraste exigido y respeta el piso", () => {
    const a3 = dimOpacity(neutral.color.text, neutral.color.bg, { min: 3 });
    const a45 = dimOpacity(neutral.color.text, neutral.color.bg, { min: 4.5 });
    expect(a45).toBeGreaterThan(a3);
    expect(a3).toBeGreaterThan(0.2);
    expect(dimOpacity(neutral.color.text, neutral.color.bg, { min: 1.2, floor: 0.6 })).toBe(0.6);
  });
  it("un texto que ya es flojo contra el fondo no se atenúa (1)", () => {
    expect(dimOpacity("#dddddd", "#ffffff", { min: 3 })).toBe(1);
  });
  it("es determinista y rechaza colores inválidos", () => {
    expect(dimOpacity("#111", "#fff")).toBe(dimOpacity("#111", "#fff"));
    expect(() => dimOpacity("nada", "#fff")).toThrow(/inválido/);
  });
});

describe("dimmedColor", () => {
  it("acepta roles y devuelve un color que llega al contraste", () => {
    for (const t of [neutral, dark, neon]) {
      const c = dimmedColor(t, "text", "surface", { min: 3 });
      expect(contrastRatio(c, t.color.surface)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(c, t.color.surface)).toBeLessThan(contrastRatio(t.color.text, t.color.surface));
    }
  });
  it("acepta colores ya sacados del tema como fondo", () => {
    const c = dimmedColor(neutral, "accent", neutral.color.bg, { min: 3 });
    expect(contrastRatio(c, neutral.color.bg)).toBeGreaterThanOrEqual(3);
  });
});
