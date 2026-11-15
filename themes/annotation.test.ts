import { describe, expect, it } from "vitest";
import {
  DEFAULT_STYLE, STYLE_ENUMS, annotationLook, checkTheme, dark, doodleStyle, editorial, exitPower, markHasConnector, neon, neutral, papel,
  resolveAnnotationMark, resolveTheme, styleIssues, themeCharacter, themeFromTokens,
} from "./index";

describe("style.annotation: la señal la decide el design system", () => {
  it("cada uno de los cinco temas declara una señal propia y solo papel usa el trazo a mano", () => {
    const marks = [neutral, dark, editorial, neon, papel].map((t) => resolveAnnotationMark(t));
    expect(marks).toEqual(["arrow", "elbow", "bracket", "ring", "hand"]);
    expect(marks.filter((m) => m === "hand")).toHaveLength(1);
  });
  it("un tema sin el grupo deriva de decor (compatibilidad)", () => {
    expect(DEFAULT_STYLE.annotation.mark).toBe("auto");
    const t = (decor: object) => resolveTheme({ ...neutral, style: { decor } } as never);
    expect(resolveAnnotationMark(t({ doodles: false }))).toBe("none");
    expect(resolveAnnotationMark(t({ doodles: true, doodleStroke: "hand" }))).toBe("hand");
    expect(resolveAnnotationMark(t({ doodles: true, doodleStroke: "geometric" }))).toBe("arrow");
    expect(doodleStyle(t({ doodleStroke: "hand" }))).toEqual({ enabled: true, jitter: true });
  });
  it("un design system de tokens que ya declaraba su política de garabatos la conserva (no hereda la señal de neutral)", () => {
    const th = themeFromTokens({ "style-decor-doodles": "true", "style-decor-doodle-stroke": "hand" });
    expect(th.style.annotation.mark).toBe("auto");
    expect(resolveAnnotationMark(th)).toBe("hand");
    expect(themeFromTokens({}).style.annotation.mark).toBe("arrow");
    expect(themeFromTokens({ "style-annotation-mark": "bracket", "style-decor-doodle-stroke": "hand" }).style.annotation.mark).toBe("bracket");
  });
  it("variant fuerza otra señal y se nota como excepción", () => {
    expect(annotationLook(neutral).forced).toBe(false);
    const l = annotationLook(neutral, "underline");
    expect(l.mark).toBe("underline");
    expect(l.forced).toBe(true);
    expect(annotationLook(neutral, "auto").mark).toBe("arrow");
  });
  it("lee el grosor, la terminación y el halo de style.line", () => {
    expect(annotationLook(editorial)).toMatchObject({ widthK: 0.5, square: true, glow: 0 });
    expect(annotationLook(neon)).toMatchObject({ widthK: 1.8, glow: 0.8 });
  });
  it("valida los valores y lista lo que acepta", () => {
    expect(styleIssues({ annotation: { mark: "flecha" } })[0]!.accepted).toContain("bracket");
    expect(styleIssues({ annotation: { dim: 2 } })).toHaveLength(1);
    expect(STYLE_ENUMS.annotationMark).toContain("focus");
    expect(markHasConnector("arrow")).toBe(true);
    expect(markHasConnector("ring")).toBe(false);
  });
  it("los cinco temas pasan checkTheme sin errores", () => {
    for (const t of [neutral, dark, editorial, neon, papel]) expect(checkTheme(t).filter((w) => w.severity === "error"), t.name).toEqual([]);
  });
  it("exit: settle con transition through es un error; la salida por defecto no cambia el power", () => {
    expect(exitPower(neutral, 60)).toBe(60);
    expect(exitPower(editorial, 60)).toBe(1.5);
    const mal = resolveTheme({ ...neutral, style: { motion: { transition: "through", exit: "settle" } } } as never);
    expect(checkTheme(mal).some((w) => w.pair === "style.motion.exit/transition" && w.severity === "error")).toBe(true);
  });
  it("el carácter se deduce del estilo", () => {
    expect(themeCharacter(papel)).toBe("ludico-manual");
    expect(themeCharacter(editorial)).toBe("editorial");
  });
});
