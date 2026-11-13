import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { ThemeProvider, useTheme, withAlpha, neutral, dark } from "./index";

const Name = () => <span>{useTheme().name}</span>;

describe("ThemeProvider", () => {
  it("usa neutral por defecto", () => {
    expect(renderToString(<Name />)).toContain("neutral");
  });
  it("permite sobrescribir", () => {
    expect(renderToString(<ThemeProvider theme={dark}><Name /></ThemeProvider>)).toContain("dark");
  });
  it("anida", () => {
    const html = renderToString(
      <ThemeProvider theme={dark}><ThemeProvider theme={neutral}><Name /></ThemeProvider></ThemeProvider>,
    );
    expect(html).toContain("neutral");
  });
});

describe("withAlpha", () => {
  it("hex", () => expect(withAlpha("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)"));
  it("hex corto", () => expect(withAlpha("#0f0", 0.25)).toBe("rgba(0, 255, 0, 0.25)"));
  it("rgb", () => expect(withAlpha("rgb(1,2,3)", 0.1)).toBe("rgba(1, 2, 3, 0.1)"));
  it("rgba reemplaza alfa", () => expect(withAlpha("rgba(1,2,3,0.9)", 0.2)).toBe("rgba(1, 2, 3, 0.2)"));
  it("inválido se devuelve igual", () => expect(withAlpha("nope", 0.5)).toBe("nope"));
});

import { parseColor } from "./index";
describe("hsl unidades", () => {
  const red = { r: 255, g: 0, b: 0 };
  it("deg, turn, rad, sin unidad", () => {
    for (const h of ["120deg", "0.3333333turn", "2.0944rad", "120"]) {
      const c = parseColor(`hsl(${h} 100% 50%)`)!;
      expect(c.g).toBe(255);
      expect(c.r).toBeLessThan(3);
    }
    expect(parseColor("hsl(0turn 100% 50%)")).toMatchObject(red);
    expect(parseColor("hsl(1turn, 100%, 50%)")).toMatchObject(red);
  });
});
