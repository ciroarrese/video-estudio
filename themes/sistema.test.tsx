import { describe, expect, it } from "vitest";
import {
  DEFAULT_STYLE, accentMark, checkTheme, cornerRadius, editorial, entrance, neon, neutral, papel, resolveStyleInput, staggerFrames, staggerOverride, staggerScale,
  storyDefaults, styleIssues, styleTokenName, textStyle, themeFromTokens, themeFromTokensWithReport, vignetteColor,
} from "./index";
import type { Theme } from "./index";

/** Cierre de lo que un design system no podía declarar: cada campo nuevo con su valor por defecto idéntico al de siempre, su validación y su ayuda. */

describe("nube: cloud.blur", () => {
  it("--cloud-blur entra al tema y al informe; un valor inválido avisa y se ignora", () => {
    const { theme, report } = themeFromTokensWithReport("--cloud-blur: 64px;");
    expect(theme.cloud.blur).toBe(64);
    expect(report.mapped["cloud.blur"]).toBe("cloud-blur");
    const mal = themeFromTokensWithReport("--cloud-blur: 900;");
    expect(mal.theme.cloud.blur).toBeUndefined();
    expect(mal.report.warnings.join("\n")).toMatch(/Desenfoque de nubes/);
  });
  it("neutral no lo declara (queda el 110 de siempre en CloudBackground)", () => {
    expect(neutral.cloud.blur).toBeUndefined();
    expect(neon.cloud.blur).toBe(140);
  });
});

describe("escalonado por contexto (motion.staggerList, staggerRows, staggerItems, staggerChips)", () => {
  it("por defecto no hay pasos de contexto y todo da lo de siempre", () => {
    for (const c of ["list", "rows", "items", "chips"] as const) expect(staggerOverride(neutral, c)).toBeNull();
    expect(staggerFrames(neutral, 3, { context: "list", base: 3 })).toBe(9);
    expect(staggerFrames(neutral, 3, { context: "rows" })).toBe(12);
    expect(staggerScale(neutral, "items")).toBe(1);
  });
  it("con un paso de contexto manda ese paso en cuadros (sin escalar por base) y `scale` lo estira", () => {
    const t = themeFromTokens("--style-motion-stagger-list: 22; --style-motion-stagger-rows: 3; --style-motion-stagger-chips: 0.25;");
    expect(staggerFrames(t, 4, { context: "list", base: 12 })).toBe(88);
    expect(staggerFrames(t, 4, { context: "list", base: 12, scale: 0.5 })).toBe(44);
    expect(staggerFrames(t, 2, { context: "rows", base: 3 })).toBe(6);
    expect(staggerOverride(t, "chips")).toBe(0.25);
    // un contexto sin paso fijado sigue al base de siempre
    expect(staggerFrames(t, 3, { context: "items", base: 8 })).toBe(24);
    expect(staggerFrames(t, 3)).toBe(12);
    expect(staggerScale(t, "list")).toBe(5.5);
  });
  it("valida el rango y el nombre de los tokens", () => {
    expect(styleIssues({ motion: { staggerList: 61 } }).map((i) => i.path)).toEqual(["motion.staggerList"]);
    expect(styleIssues({ motion: { staggerList: 2.5 } }).length).toBe(1);
    expect(styleIssues({ motion: { staggerChips: 0.4, staggerItems: null } })).toEqual([]);
    expect(styleTokenName("motion.staggerChips")).toBe("style-motion-stagger-chips");
  });
  it("los ejemplos lo usan", () => {
    expect(staggerOverride(editorial, "list")).toBe(10);
    expect(staggerOverride(neon, "chips")).toBe(0.35);
    expect(staggerOverride(papel, "list")).toBeNull();
  });
});

describe("curvas y duraciones como tokens", () => {
  it("lee --ease-* (cubic-bezier, lista de números) y --duration-* (cuadros, ms, s)", () => {
    const css = `:root { --ease-standard: cubic-bezier(0.1, 0.2, 0.3, 0.4); --ease-out: 0.2 0 0 1; --ease-in-out: 0.5, 0, 0.5, 1;
      --duration-fast: 6; --duration-base: 400ms; --duration-slow: 1.2s; }`;
    const { theme, report } = themeFromTokensWithReport(css);
    expect(theme.motion.easing).toEqual({ standard: [0.1, 0.2, 0.3, 0.4], out: [0.2, 0, 0, 1], inOut: [0.5, 0, 0.5, 1] });
    expect(theme.motion.duration).toEqual({ fast: 6, base: 12, slow: 36 });
    expect(report.mapped["motion.easing.out"]).toBe("ease-out");
    expect(report.mapped["motion.duration.base"]).toBe("duration-base");
  });
  it("lee la lista de un JSON W3C y las duraciones con unidad", () => {
    const t = themeFromTokens({ ease: { standard: { $value: [0.3, 0, 0.1, 1] } }, duration: { fast: "10f", slow: { $value: "0.5s" } } });
    expect(t.motion.easing.standard).toEqual([0.3, 0, 0.1, 1]);
    expect(t.motion.duration.fast).toBe(10);
    expect(t.motion.duration.slow).toBe(15);
  });
  it("lo inválido avisa y deja el valor de la base", () => {
    const { theme, report } = themeFromTokensWithReport("--ease-out: cubic-bezier(2, 0, 0, 1); --duration-fast: rápido; --duration-slow: 0ms;");
    expect(theme.motion.easing.out).toEqual(neutral.motion.easing.out);
    expect(theme.motion.duration).toEqual(neutral.motion.duration);
    expect(report.warnings.join("\n")).toMatch(/Curva inválida ignorada en "ease-out"/);
    expect(report.warnings.join("\n")).toMatch(/Duración/);
  });
});

describe("caption: subtítulos y líneas de apoyo", () => {
  it("por defecto sigue al eyebrow (editorial: mayúsculas) y `follow: false` no toca nada", () => {
    expect(textStyle(neutral, "caption")).toEqual(textStyle(neutral, "eyebrow"));
    expect(textStyle(neon, "caption")).toEqual(textStyle(neon, "eyebrow"));
    expect(textStyle(neutral, "caption", { follow: false })).toEqual({});
    expect(textStyle(neon, "caption", { follow: false })).toEqual({});
  });
  it("editorial: eyebrows en mayúsculas y captions en caja normal, sin interletrado", () => {
    expect(textStyle(editorial, "eyebrow")).toMatchObject({ textTransform: "uppercase", letterSpacing: "0.14em" });
    expect(textStyle(editorial, "caption")).toEqual({});
  });
  it("caja, interletrado y peso propios", () => {
    const t = themeFromTokens({}, neutral, { style: { type: { eyebrowCase: "upper", eyebrowTracking: 0.1, captionCase: "lower", captionTracking: 0.02, captionWeight: "semibold" } } });
    expect(textStyle(t, "caption")).toEqual({ textTransform: "lowercase", letterSpacing: "0.02em", fontWeight: t.font.weights.semibold });
    expect(textStyle(t, "eyebrow")).toEqual({ textTransform: "uppercase", letterSpacing: "0.1em" });
    expect(styleIssues({ type: { captionCase: "title" } }).length).toBe(1);
  });
});

describe("decoración: viñeta y marca de acento", () => {
  it("vignetteColor es el acento por defecto y se puede cambiar por rol", () => {
    expect(vignetteColor(neutral)).toBe("accent");
    expect(vignetteColor(neon)).toBe("accent2");
    expect(styleIssues({ decor: { vignetteColor: "rosa" } }).length).toBe(1);
  });
  it("accentThickness multiplica el grosor de cada pieza", () => {
    expect(accentMark(neutral, { length: 100 })!.style.height).toBe(8);
    expect(accentMark(neutral, { length: 100, thickness: 10 })!.style.height).toBe(10);
    const grueso = themeFromTokens({}, neutral, { style: { decor: { accentThickness: 1.5 } } });
    expect(accentMark(grueso, { length: 100 })!.style.height).toBe(12);
    expect(accentMark(grueso, { length: 100, thickness: 10 })!.style.height).toBe(15);
    expect(accentMark(editorial, { length: 100 })!.style.height).toBe(2); // filete fino: max(2, round(4 * 0.4))
    const punto = themeFromTokens({}, neutral, { style: { decor: { accent: "dot", accentThickness: 2 } } });
    expect(accentMark(punto, { length: 100 })!.style.width).toBe(24);
    expect(styleIssues({ decor: { accentThickness: 5 } }).length).toBe(1);
  });
});

describe("entrada en profundidad (motion.entrance: depth)", () => {
  const depth = themeFromTokens({}, neutral, { style: { motion: { entrance: "depth" } } });
  it("lleva su propia perspective() y translate3d, sin preserve-3d, y no deja residuos en reposo", () => {
    const e = entrance(depth, 0.5, 0, { round: false });
    expect(e.transform).toBe("perspective(1400px) translate3d(0px, 0px, -300px)");
    expect(e.opacity).toBe(0.5);
    expect(JSON.stringify(e)).not.toMatch(/preserve-3d/);
    expect(entrance(depth, 1)).toEqual({});
    expect(entrance(depth, 0).opacity).toBe(0);
  });
  it("es la misma cuenta que `flyInZ` de kit/ (900 px de profundidad, perspectiva de 1400 px)", () => {
    const e = entrance(depth, 0.25, 0, { depth: 900, round: false });
    expect(e.transform).toBe("perspective(1400px) translate3d(0px, 0px, -675px)");
  });
  it("el traslado extra va dentro del mismo translate3d y la profundidad se acota a la perspectiva", () => {
    expect(entrance(depth, 0.5, 0, { depth: 600, offset: { x: 10, y: 5 } }).transform).toBe("perspective(1400px) translate3d(10px, 5px, -300px)");
    expect(entrance(depth, 0, 0, { depth: 5000 }).transform).toBe("perspective(1400px) translate3d(0px, 0px, -1300px)");
  });
  it("neon lo declara y una entrada propia (`native`) manda solo con `auto`", () => {
    expect(neon.style.motion.entrance).toBe("depth");
    expect(entrance(neutral, 0.5, 0, { native: "depth", round: false }).transform).toBe("perspective(1400px) translate3d(0px, 0px, -300px)");
  });
});

describe("radio del cartel: shape.heroScale", () => {
  it("por defecto 2 con pill, 1,5 con rounded; heroScale lo reemplaza y sharp sigue en 0", () => {
    expect(cornerRadius(neutral, "hero")).toBe(neutral.radius.lg * 2);
    expect(cornerRadius(papel, "hero")).toBe(papel.radius.lg * 1.25);
    expect(cornerRadius(neon, "hero")).toBe(neon.radius.lg * 1.4);
    expect(cornerRadius(editorial, "hero")).toBe(0);
    const r = themeFromTokens({}, neutral, { style: { shape: { corners: "rounded" } } });
    expect(cornerRadius(r, "hero")).toBe(r.radius.lg * 1.5);
    expect(styleIssues({ shape: { heroScale: 9 } }).length).toBe(1);
  });
});

describe("muro de la apertura: separación, ladrillo y temblor en el estilo", () => {
  it("los valores por defecto del tema son los de siempre", () => {
    expect(storyDefaults(neutral).wall).toMatchObject({ gapX: 1, gapY: 1, brick: 1, jitter: 1 });
    expect(DEFAULT_STYLE.story).toMatchObject({ wallGapX: 1, wallGapY: 1, wallBrick: 1, wallJitter: 1 });
  });
  it("editorial es una grilla ajustada y neón un muro suelto", () => {
    expect(storyDefaults(editorial).wall).toMatchObject({ brick: 0, jitter: 0, gapX: 0.85 });
    expect(storyDefaults(neon).wall).toMatchObject({ brick: 1.5, jitter: 2.2 });
  });
  it("valida los rangos", () => {
    expect(styleIssues({ story: { wallGapX: 0.2, wallBrick: 4, wallJitter: 5 } }).map((i) => i.path)).toEqual(["story.wallGapX", "story.wallBrick", "story.wallJitter"]);
    expect(resolveStyleInput({ story: { wallJitter: 0 } }).story.wallJitter).toBe(0);
  });
});

describe("colores de datos con superficies propias", () => {
  const css = "--data-ok: #2fa86b; --data-ficha: #101820;";
  const base: Theme = neutral;
  it("sobre las superficies del tema, como siempre", () => {
    const t = themeFromTokens(css, base, { data: { ok: { on: ["bg"], min: 4.5 } } });
    expect(checkTheme(t).some((w) => w.pair === "data.ok/bg")).toBe(true);
  });
  it("una interfaz con sus propias superficies se juzga solo contra ellas y el aviso lleva el ámbito", () => {
    const { theme, report } = themeFromTokensWithReport(css, base, {
      data: { ficha: { on: [] }, ok: { on: ["data.ficha"], min: 4.5, scope: "dentro de la ficha oscura" } },
    });
    expect(report.data.ok.on).toEqual(["data.ficha"]);
    expect(report.data.ok.scope).toBe("dentro de la ficha oscura");
    expect(checkTheme(theme).filter((w) => w.pair.startsWith("data.ok/") || w.pair.startsWith("data.ficha/"))).toEqual([]);
    const claro = themeFromTokens("--data-ok: #bfe8d0; --data-ficha: #101820;", base, { data: { ficha: { on: [] }, ok: { on: ["#ffffff"], min: 4.5, scope: "tabla clara" } } });
    const w = checkTheme(claro).find((x) => x.pair === "data.ok/#ffffff")!;
    expect(w.severity).toBe("error");
    expect(w.message).toMatch(/Ámbito declarado: tabla clara/);
    expect(w.message).toMatch(/qa/);
  });
  it("una superficie que no existe avisa y se ignora", () => {
    const { report } = themeFromTokensWithReport(css, base, { data: { ok: { on: ["fondoRaro"] } } });
    expect(report.warnings.join("\n")).toMatch(/"fondoRaro"/);
    expect(report.data.ok.on).toEqual(["surface"]);
  });
  it("los cinco design systems pasan checkTheme", () => {
    for (const t of [neutral, editorial, neon, papel]) expect(checkTheme(t)).toEqual([]);
  });
});
