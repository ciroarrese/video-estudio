import { describe, expect, it } from "vitest";
import {
  DEFAULT_STYLE, checkTheme, dark, depthLook, editorial, lineLook, neon, neutral, papel, resolveStyleInput, sketchOffset, solidLook, styleIssues,
  styleTokenName, textLook, themeFromTokens, themeFromTokensWithReport,
} from "./index";

// Capa de línea, sólidos, profundidad y texto de los efectos (`style.line`, `style.solid`, `style.depth`, `style.text`).
describe("style.line / solid / depth / text", () => {
  it("por defecto reproducen lo de siempre (neutral y dark no declaran nada de esto)", () => {
    for (const t of [neutral, dark]) {
      expect(t.style.line).toEqual({ weight: "regular", dash: "solid", cap: "round", glow: 0, dotShape: "round", accentUse: "balanced", sketch: 0 });
      expect(t.style.solid).toEqual({ fill: "shaded", contrast: 1, edge: "gap" });
      expect(t.style.depth).toEqual({ extrude: "stack", fog: true });
      expect(t.style.text).toEqual({ arrival: "rise", caret: "bar", tile: "card", charset: "caps", decoration: "none" });
      expect(lineLook(t)).toEqual({ widthK: 1, dotK: 1, dash: "solid", square: false, glow: 0, dotShape: "round", accentUse: "balanced", sketch: 0 });
      expect(solidLook(t)).toEqual({ fill: "shaded", contrast: 1, edge: "gap" });
      expect(depthLook(t)).toEqual({ extrude: "stack", fog: true });
      expect(textLook(t)).toMatchObject({ arrival: "rise", caret: "bar", tile: "card", glyphs: undefined, decoration: "none", glow: 0, dotShape: "round", weightK: 1 });
    }
    expect(DEFAULT_STYLE.line.glow).toBe(0);
  });

  it("los tres design systems de ejemplo se separan en cada grupo", () => {
    for (const g of ["line", "solid", "depth", "text"] as const) {
      const [a, b, c] = [editorial, neon, papel].map((t) => JSON.stringify(t.style[g]));
      expect(new Set([a, b, c]).size, g).toBe(3);
    }
    expect(lineLook(editorial)).toMatchObject({ widthK: 0.5, square: true, glow: 0, dotShape: "square", accentUse: "sparse" });
    expect(lineLook(neon)).toMatchObject({ widthK: 1.8, glow: 0.8, accentUse: "rich" });
    expect(lineLook(papel)).toMatchObject({ dash: "dashed", sketch: 0.7, dotShape: "cross" });
    expect(solidLook(editorial).fill).toBe("outline");
    expect(solidLook(neon).fill).toBe("translucent");
    expect(solidLook(papel).fill).toBe("flat");
    expect(textLook(papel).decoration).toBe("marker");
    expect(textLook(neon).glyphs).toBe("0123456789ABCDEF");
  });

  it("valores inválidos se informan con lo que acepta el campo", () => {
    const issues = styleIssues({ line: { weight: "grueso", glow: 3 }, text: { caret: "linea" }, depth: { fog: "tal vez" } });
    expect(issues.map((i) => i.path).sort()).toEqual(["depth.fog", "line.glow", "line.weight", "text.caret"]);
    expect(issues.find((i) => i.path === "line.weight")!.accepted).toBe("regular | hairline | bold");
    expect(() => resolveStyleInput({ solid: { edge: "rojo" } } as never)).toThrow(/solid\.edge/);
  });

  it("los tokens `--style-<grupo>-<campo>` y la forma compacta llegan al estilo", () => {
    expect(styleTokenName("line.dotShape")).toBe("style-line-dot-shape");
    const t = themeFromTokens({ "style-line-weight": "bold", "style-line-dot-shape": "cross", "style-solid-fill": "outline", "style-depth-fog": "off", "style-text-decoration": "marker" });
    expect(t.style.line).toMatchObject({ weight: "bold", dotShape: "cross" });
    expect(t.style.solid.fill).toBe("outline");
    expect(t.style.depth.fog).toBe(false);
    expect(t.style.text.decoration).toBe("marker");
    const { theme, report } = themeFromTokensWithReport({}, neutral, { style: { line: { glow: 0.5, sketch: 2 as never }, text: { tile: "outline" } } });
    expect(theme.style.line.glow).toBe(0.5);
    expect(theme.style.text.tile).toBe("outline");
    expect(report.style.invalid.map((i) => i.path)).toEqual(["line.sketch"]);
    expect(report.style.mapped["text.tile"]).toBe("options.style");
  });

  it("los temas de ejemplo siguen pasando checkTheme sin reconocimientos", () => {
    for (const t of [editorial, neon, papel]) expect(checkTheme(t), t.name).toEqual([]);
  });

  it("sketchOffset es función pura de la posición y acotada por la amplitud", () => {
    expect(sketchOffset(120, 80, 3)).toEqual(sketchOffset(120, 80, 3));
    expect(sketchOffset(10, 10, 0)).toEqual({ dx: 0, dy: 0 });
    for (let x = 0; x < 900; x += 37) for (let y = 0; y < 900; y += 41) {
      const o = sketchOffset(x, y, 3);
      expect(Math.abs(o.dx)).toBeLessThanOrEqual(3.0001);
      expect(Math.abs(o.dy)).toBeLessThanOrEqual(3.0001);
    }
  });
});
