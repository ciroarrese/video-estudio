import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STYLE, STYLE_FIELDS, ThemeProvider, accentMark, backgroundLayer, cameraOptions, chartFill, chartStyle, checkTheme, cornerRadius, dark,
  doodleStyle, editorial, entrance, highlightStyle, neon, neutral, numeralStyle, papel, resolveStyle, resolveStyleInput, settle, staggerFrames, staggerScale, storyDefaults,
  styleIssues, styleTokenName, surfaceStyle, textStyle, themeFromTokens, themeFromTokensWithReport, transitionVeil, useTheme, vignetteStrength,
  withAlpha, withStoryDefaults, borderWidth, surfaceParts,
} from "./index";

const c = neutral.color;

describe("valores por defecto = lo que las piezas dibujan hoy", () => {
  it("neutral y dark traen el estilo por defecto, completo y congelado", () => {
    expect(neutral.style).toEqual(DEFAULT_STYLE);
    expect(dark.style).toEqual(DEFAULT_STYLE);
    expect(Object.isFrozen(neutral.style)).toBe(true);
    expect(Object.isFrozen(neutral.style.shape)).toBe(true);
  });

  it("radios: chip y píldora = pill; tarjeta y panel = lg; cartel = lg * 2; control = md; barra = pill", () => {
    expect(cornerRadius(neutral, "chip")).toBe(neutral.radius.pill); // Chip, Pill, DockedHeadline
    expect(cornerRadius(neutral, "card")).toBe(20); // NotificationStack: theme.radius.lg
    expect(cornerRadius(neutral, "panel")).toBe(14); // panel de un diagrama o de una interfaz: theme.radius.panel
    expect(cornerRadius(neutral, "window")).toBe(20); // panel del cierre, paleta de comandos, plano: theme.radius.lg
    expect(cornerRadius(neutral, "hero")).toBe(40); // cartel de la apertura: theme.radius.lg * 2
    expect(cornerRadius(neutral, "control")).toBe(10); // BarsGrow: theme.radius.md
    expect(cornerRadius(neutral, "bar")).toBe(999); // barra de la lista y de la firma: theme.radius.pill
  });

  it("tarjeta (NotificationStack): surface, 1px border, shadow.md, radius.lg", () => {
    expect(surfaceStyle(neutral, "card")).toEqual({ borderRadius: 20, background: c.surface, border: `1px solid ${c.border}`, boxShadow: neutral.shadow.md });
  });

  it("panel del cierre (ventana): 1px border, shadow.lg, radius.lg; el panel mediano usa radius.panel", () => {
    expect(surfaceStyle(neutral, "panel").borderRadius).toBe(14);
    expect(surfaceStyle(neutral, "window")).toEqual({ borderRadius: 20, background: c.surface, border: `1px solid ${c.border}`, boxShadow: neutral.shadow.lg });
  });

  it("píldora del titular (DockedHeadline): pill, 1px, shadow.md", () => {
    expect(surfaceStyle(neutral, "headline")).toEqual({ borderRadius: 999, background: c.surface, border: `1px solid ${c.border}`, boxShadow: neutral.shadow.md });
  });

  it("chip del muro: 2px; encendido = acento al 55 % (tenue 30 %); el pop agrega el halo de siempre", () => {
    expect(surfaceStyle(neutral, "chip")).toEqual({ borderRadius: 999, background: c.surface, border: `2px solid ${c.border}`, boxShadow: neutral.shadow.md });
    expect(surfaceStyle(neutral, "chip", { on: true }).border).toBe(`2px solid ${withAlpha(c.accent, 0.55)}`);
    expect(surfaceStyle(neutral, "chip", { on: true, faint: true }).border).toBe(`2px solid ${withAlpha(c.accent, 0.3)}`);
    expect(surfaceStyle(neutral, "chip", { glow: 0.5 }).boxShadow).toBe(`${neutral.shadow.md}, 0 0 27px ${withAlpha(c.accent, 0.45 * 0.5)}`);
  });

  it("píldora del cierre: 3px de acento al 66 % y halo 18px de acento al 25 %", () => {
    const s = surfaceStyle(neutral, "pill");
    expect(s.border).toBe(`3px solid ${withAlpha(c.accent, 0.66)}`);
    expect(s.boxShadow).toBe(`${neutral.shadow.lg}, 0 0 18px ${withAlpha(c.accent, 0.25)}`);
    expect(surfaceStyle(neutral, "pill", { glow: 1 }).boxShadow).toBe(`${neutral.shadow.lg}, 0 0 52px ${withAlpha(c.accent, 0.65)}`);
  });

  it("cartel de la apertura: sólido sin borde; vidrio 0,74 con borde de 1px surface al 90 %", () => {
    expect(surfaceStyle(neutral, "title")).toEqual({
      borderRadius: 40,
      background: c.surface,
      boxShadow: `0 40px 90px -30px ${withAlpha(c.text, 0.35)}, ${neutral.shadow.lg}`,
    });
    const glass = themeFromTokens({}, neutral, { style: { story: { titleCard: "glass" } } });
    const g = surfaceStyle(glass, "title");
    expect(g.background).toBe(withAlpha(c.surface, 0.74));
    expect(g.border).toBe(`1px solid ${withAlpha(c.surface, 0.9)}`);
  });

  it("texto: titular semibold (600), rótulo medium (500), sin interletrado ni mayúsculas", () => {
    expect(textStyle(neutral, "title")).toEqual({ fontWeight: 600 });
    expect(textStyle(neutral, "label")).toEqual({ fontWeight: 500 });
    expect(textStyle(neutral, "eyebrow")).toEqual({});
    expect(textStyle(neutral, "title", { tracking: -0.02 })).toEqual({ fontWeight: 600, letterSpacing: "-0.02em" }); // nombres de la lista
  });

  it("números y resalte: el degradado de GradientText, quieto", () => {
    const g = { background: neutral.gradient.brand, backgroundSize: "100% 100%", backgroundPosition: "0% 0", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" };
    expect(numeralStyle(neutral)).toEqual(g);
    expect(highlightStyle(neutral)).toEqual(g);
    // con vaivén: el mismo cálculo que GradientText (50 + 50 * seno)
    const t = themeFromTokens({}, neutral, { style: { decor: { gradientLoop: 120 } } });
    expect(numeralStyle(t, { frame: 30 })).toMatchObject({ backgroundSize: "200% 100%", backgroundPosition: "100% 0" });
    expect(numeralStyle(t, { frame: 0 })).toEqual(numeralStyle(t, { frame: 120 }));
  });

  it("fondo: nubes con la opacidad del tema; ningún patrón", () => {
    expect(backgroundLayer(neutral)).toEqual({ kind: "clouds", clouds: true, cloudOpacity: 0.18 });
  });

  it("movimiento y decoración: sin rebote, cámara sin cambios, viñeta y garabatos como siempre", () => {
    expect(cameraOptions(neutral)).toEqual({});
    expect(vignetteStrength(neutral)).toBe(1);
    expect(doodleStyle(neutral)).toEqual({ enabled: true, jitter: true });
    expect(settle(0.3, 0)).toBe(0.3);
    expect(staggerFrames(neutral, 3)).toBe(12);
    expect(staggerFrames(neutral, 3, { base: 2 })).toBe(6); // paso propio de la pieza, sin cambio
    expect(transitionVeil(neutral, 0.5)).toEqual({ kind: "wash", style: { background: c.bg, opacity: 0.5 } });
  });

  it("barra de acento = la de la lista y la firma (8 px, pill, degradado de marca)", () => {
    expect(accentMark(neutral, { length: 400, progress: 0.5 })).toEqual({ kind: "bar", style: { width: 200, height: 8, borderRadius: 999, background: neutral.gradient.brand } });
  });

  it("gráficos: radio de barra = radius.md, línea de 5 px, guías según el gráfico", () => {
    expect(chartStyle(neutral)).toEqual({ barRadius: 10, lineWidth: 5, grid: "auto", fill: "solid" });
    expect(chartFill(neutral, "#123456", "a")).toEqual({ kind: "solid", fill: "#123456" });
  });

  it("historias: el diseño de siempre", () => {
    expect(storyDefaults(neutral)).toEqual({
      titleCard: "solid",
      list: { layout: "stacked", underline: "row" },
      handoff: "wash",
      headline: { size: "md" },
      closing: { bg: "bg", bar: true },
      wall: { blur: { opening: true, closing: true }, chipScale: 1, dolly: 0, depth: 1 },
    });
  });

  it("withStoryDefaults: lo del video gana, acepta las formas cortas y deja pasar el resto", () => {
    const d = withStoryDefaults(neon, { list: "inline" as const, wall: { rows: 3, blur: false }, clouds: { opacity: 0.1 } });
    expect(d.list).toEqual({ layout: "inline", underline: "name" });
    expect(d.wall).toMatchObject({ columns: 8, rows: 3, blur: { opening: false, closing: false }, chipScale: 0.85 });
    expect(d.titleCard).toBe("glass");
    expect(d.gradient).toEqual({ loop: 90 });
    expect((d as { clouds?: unknown }).clouds).toEqual({ opacity: 0.1 });
    const e = withStoryDefaults(neutral, { handoff: "dock" as const, closing: { bg: "surface" } });
    expect(e.handoff).toBe("dock");
    expect(e.closing).toEqual({ bg: "surface", bar: true });
  });
});

describe("campos, validación y errores", () => {
  it("cada campo tiene un token único y un valor por defecto válido", () => {
    const names = STYLE_FIELDS.map((f) => styleTokenName(f.path));
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("style-story-wall-chip-scale");
    expect(names).toContain("style-shape-corners");
    expect(styleIssues(DEFAULT_STYLE)).toEqual([]);
    expect(resolveStyleInput({})).toEqual(DEFAULT_STYLE);
  });

  it("un valor inválido lanza un error que lista lo que se acepta", () => {
    expect(() => resolveStyleInput({ shape: { corners: "cuadrado" as never } })).toThrow(/style\.shape\.corners = "cuadrado" \(acepta pill \| rounded \| sharp\)/);
    expect(() => resolveStyleInput({ motion: { overshoot: 2 } })).toThrow(/style\.motion\.overshoot.*de 0 a 0.3/);
    expect(() => resolveStyleInput({ decor: { gradientLoop: 1 } })).toThrow(/gradientLoop/);
    expect(() => resolveStyleInput({ nube: {} } as never)).toThrow(/grupos: shape, surface/);
    expect(() => resolveStyleInput({ shape: { esquina: 1 } } as never)).toThrow(/campos de shape: corners, border, outlined/);
  });

  it("checkTheme informa un style inválido como error, sin lanzar", () => {
    const bad = { ...neutral, style: { surface: { elevation: "sombra" } } } as never;
    const w = checkTheme(bad).find((x) => x.pair === "style.surface.elevation");
    expect(w?.severity).toBe("error");
    expect(w?.message).toContain("shadow | flat | border | glow");
  });

  it("checkTheme: vidrio tenue sobre nubes con texto atenuado", () => {
    // texto claro sobre un vidrio oscuro tenue que deja pasar un fondo claro
    const base = { ...dark, color: { ...dark.color, bg: "#e8eaf5" }, cloud: { ...dark.cloud, opacity: 0.05 } };
    const t = themeFromTokens({}, base, { style: { surface: { kind: "glass", opacity: 0.3 } } });
    const w = checkTheme(t).filter((x) => x.pair.startsWith("style.surface.glass"));
    expect(w.length).toBeGreaterThan(0);
    expect(w[0]!.message).toMatch(/Subí surface\.opacity a/);
    // con el fondo liso y opacidad alta pasa
    const ok = themeFromTokens({}, base, { style: { surface: { kind: "glass", opacity: 0.95 }, background: { kind: "plain" } } });
    expect(checkTheme(ok).filter((x) => x.pair.startsWith("style.surface"))).toEqual([]);
  });

  it("checkTheme: marcador, números atenuados, patrón cargado y tarjetas sin borde ni sombra", () => {
    const flat = themeFromTokens({}, neutral, { style: { shape: { outlined: false }, surface: { elevation: "flat" } } });
    expect(checkTheme(flat).some((x) => x.pair === "style.surface/edge")).toBe(true);
    const muted = themeFromTokens({}, neutral, { style: { type: { numerals: "muted" } }, color: undefined } as never);
    expect(checkTheme(muted).some((x) => x.pair === "style.type.numerals/textMuted")).toBe(false); // textMuted del neutro llega a 3:1
    const heavy = themeFromTokens({}, neutral, { style: { background: { kind: "grid", intensity: 1 } } });
    expect(checkTheme(heavy).every((x) => !x.pair.startsWith("style.background"))).toBe(true);
    const weak = themeFromTokens({ color: { accent: "#ff00aa", text: "#7a7a8a" } }, neutral, { style: { type: { highlight: "marker" } } });
    expect(checkTheme(weak).some((x) => x.pair === "style.type.highlight/marker")).toBe(true);
  });

  it("un par de estilo se puede reconocer en acknowledge", () => {
    const t = { ...themeFromTokens({ color: { accent: "#ff00aa", text: "#7a7a8a" } }, neutral, { style: { type: { highlight: "marker" } } }), acknowledge: ["style.type.highlight/marker"] };
    const w = checkTheme(t).find((x) => x.pair === "style.type.highlight/marker");
    expect(w?.severity).toBe("note");
    expect(checkTheme(t).some((x) => /no es un par que se revise/.test(x.message))).toBe(false);
  });
});

describe("tokens -> style", () => {
  const css = `:root {
    --style-shape-corners: sharp;
    --style-shape-border: 2px;
    --style-shape-outlined: off;
    --style-surface-kind: glass;
    --style-surface-opacity: 80%;
    --style-type-eyebrow-case: upper;
    --style-motion-overshoot: 0.1;
    --style-motion-camera-blur: false;
    --style-story-wall-columns: 8;
    --style-story-wall-rows: auto;
    --style-story-closing-bg: surface;
    --style-story-wall-chip-scale: 0.9;
  }`;

  it("mapea los tokens y lo informa", () => {
    const { theme, report } = themeFromTokensWithReport(css);
    const s = theme.style;
    expect(s.shape).toEqual({ corners: "sharp", border: 2, outlined: false });
    expect(s.surface).toMatchObject({ kind: "glass", opacity: 0.8, elevation: "shadow" });
    expect(s.type.eyebrowCase).toBe("upper");
    expect(s.motion).toMatchObject({ overshoot: 0.1, cameraBlur: false });
    expect(s.story).toMatchObject({ wallColumns: 8, wallRows: null, closingBg: "surface", wallChipScale: 0.9 });
    expect(report.style.mapped["shape.corners"]).toBe("style-shape-corners");
    expect(report.style.mapped["story.wallChipScale"]).toBe("style-story-wall-chip-scale");
    expect(report.style.fallback).toContain("decor.doodles");
    expect(report.style.fallback).not.toContain("shape.corners");
    expect(report.style.invalid).toEqual([]);
  });

  it("valores inválidos se ignoran, quedan en invalid con lo aceptado y en warnings", () => {
    const { theme, report } = themeFromTokensWithReport(":root{--style-shape-corners:cuadrado;--style-motion-overshoot:5;--style-decor-vignete:1;--style-surface-kind:var(--nada)}");
    expect(theme.style.shape.corners).toBe("pill");
    expect(theme.style.motion.overshoot).toBe(0);
    expect(report.style.invalid.map((i) => i.path).sort()).toEqual(["motion.overshoot", "shape.corners", "style-decor-vignete", "surface.kind"]);
    expect(report.style.invalid.find((i) => i.path === "shape.corners")?.accepted).toBe("pill | rounded | sharp");
    expect(report.warnings.filter((w) => w.startsWith("Estilo inválido ignorado")).length).toBe(4);
    expect(report.style.fallback).toContain("shape.corners");
  });

  it("JSON W3C, anidado, plano y con booleanos", () => {
    const a = themeFromTokens({ style: { decor: { doodles: { $value: false }, accent: "dot" }, shape: { border: 3 } } });
    expect(a.style.decor).toMatchObject({ doodles: false, accent: "dot" });
    expect(a.style.shape.border).toBe(3);
    const b = themeFromTokens({ "style-motion-entrance": "wipe" });
    expect(b.style.motion.entrance).toBe("wipe");
  });

  it("forma compacta: pisa a los tokens y las claves inválidas se informan sin lanzar", () => {
    const { theme, report } = themeFromTokensWithReport(css, neutral, {
      style: { shape: { corners: "rounded", border: 9 as never }, chart: { fill: "gradient" }, nube: 1 } as never,
    });
    expect(theme.style.shape.corners).toBe("rounded");
    expect(theme.style.shape.border).toBe(2); // el 9 no vale: queda el del token
    expect(theme.style.chart.fill).toBe("gradient");
    expect(report.style.mapped["shape.corners"]).toBe("options.style");
    expect(report.style.invalid.map((i) => i.path).sort()).toEqual(["nube", "shape.border"]);
  });

  it("un tema derivado hereda el estilo de su base y solo cambia lo que dicen los tokens", () => {
    const t = themeFromTokens({ color: { accent: "#0a7a4f" }, style: { motion: { stagger: 6 } } }, editorial);
    expect(t.style).toEqual({ ...editorial.style, motion: { ...editorial.style.motion, stagger: 6 } });
    const plain = themeFromTokens({ color: { accent: "#0a7a4f" } }, neon);
    expect(plain.style).toEqual(neon.style);
    const { report } = themeFromTokensWithReport({ color: { accent: "#0a7a4f" } }, neon);
    expect(report.style.fallback.length).toBe(STYLE_FIELDS.length);
    // sin base explícita, el estilo por defecto
    expect(themeFromTokens({}).style).toEqual(DEFAULT_STYLE);
  });

  it("no cambia el informe ni el tema de siempre cuando no hay tokens de estilo", () => {
    const { report } = themeFromTokensWithReport({ color: { accent: "#ff0000" } });
    expect(report.style.mapped).toEqual({});
    expect(report.warnings.some((w) => w.includes("Estilo"))).toBe(false);
  });
});

describe("ayudas: sin residuos en reposo", () => {
  const THEMES = [neutral, dark, editorial, neon, papel];
  const bad = /\(0(\.0+)?px\)|scale\(1\)|rotate\(0|opacity.?:\s*1\b|translate.*\(-0/;

  it("entrance: en reposo no devuelve nada y nunca emite identidades", () => {
    for (const entranceKind of ["rise", "fade", "scale", "slide", "wipe"] as const) {
      for (const overshoot of [0, 0.12]) {
        const t = themeFromTokens({}, neutral, { style: { motion: { entrance: entranceKind, overshoot } } });
        expect(entrance(t, 1)).toEqual({});
        expect(entrance(t, 2)).toEqual({});
        expect(entrance(t, 0)).toMatchObject({ opacity: 0 });
        for (let i = 0; i <= 40; i++) {
          const s = entrance(t, i / 40, i);
          expect(JSON.stringify(s)).not.toMatch(bad);
          if (s.opacity !== undefined) expect(s.opacity).toBeGreaterThanOrEqual(0);
          if (s.opacity !== undefined) expect(s.opacity).toBeLessThan(0.9995);
        }
      }
    }
  });

  it("entrance: formas de cada estilo", () => {
    const mk = (entranceKind: "rise" | "fade" | "scale" | "slide" | "wipe", overshoot = 0) => themeFromTokens({}, neutral, { style: { motion: { entrance: entranceKind, overshoot } } });
    expect(entrance(mk("rise"), 0.5)).toEqual({ opacity: 0.5, transform: "translateY(12px)" });
    expect(entrance(mk("fade"), 0.5)).toEqual({ opacity: 0.5 });
    expect(entrance(mk("scale"), 0.5)).toEqual({ opacity: 0.5, transform: "scale(0.925)" });
    expect(entrance(mk("slide"), 0.5, 0, { side: "right" })).toEqual({ opacity: 0.5, transform: "translateX(24px)" });
    expect(entrance(mk("slide"), 0.5, 1, { alternate: true })).toEqual({ opacity: 0.5, transform: "translateX(24px)" });
    expect(entrance(mk("wipe"), 0.25)).toEqual({ clipPath: "inset(0 75% 0 0)" });
    // el rebote pasa de la posición final y vuelve
    const peak = Math.max(...Array.from({ length: 50 }, (_, i) => settle(i / 49, 0.12)));
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.2);
    expect(settle(1, 0.12)).toBe(1);
    expect(settle(0, 0.12)).toBeCloseTo(0, 10);
  });

  it("entrance con auto: cada pieza conserva la suya; con otro valor manda el tema", () => {
    expect(neutral.style.motion.entrance).toBe("auto");
    expect(entrance(neutral, 0.5)).toEqual({ opacity: 0.5, transform: "translateY(12px)" });
    expect(entrance(neutral, 0.5, 0, { native: "slide", side: "left", distance: 30 })).toEqual({ opacity: 0.5, transform: "translateX(-15px)" }); // DockedHeadline: translateX(-30 * (1 - a))
    expect(entrance(neutral, 0.5, 0, { native: "scale" }).transform).toBe("scale(0.925)");
    const fade = themeFromTokens({}, neutral, { style: { motion: { entrance: "fade" } } });
    expect(entrance(fade, 0.5, 0, { native: "slide" })).toEqual({ opacity: 0.5 });
  });

  it("entrance: cuadros vecinos distintos pero el mismo cuadro da siempre lo mismo", () => {
    for (const t of THEMES) {
      expect(entrance(t, 0.37, 2)).toEqual(entrance(t, 0.37, 2));
      expect(surfaceStyle(t, "card")).toEqual(surfaceStyle(t, "card"));
    }
  });

  it("transitionVeil: wash, wipe, cut y through", () => {
    const mk = (transition: "wash" | "through" | "cut" | "wipe") => themeFromTokens({}, neutral, { style: { motion: { transition } } });
    expect(transitionVeil(mk("wash"), 0)).toBeNull();
    expect(transitionVeil(mk("wash"), 1)).toEqual({ kind: "wash", style: { background: c.bg } }); // cerrado: sin opacity
    expect(transitionVeil(mk("wipe"), 0.4)).toEqual({ kind: "wipe", style: { background: c.bg, clipPath: "inset(0 60% 0 0)" } });
    expect(transitionVeil(mk("wipe"), 1)).toEqual({ kind: "wipe", style: { background: c.bg } });
    expect(transitionVeil(mk("cut"), 0.99)).toBeNull();
    expect(transitionVeil(mk("cut"), 1)).toEqual({ kind: "cut", style: { background: c.bg } });
    expect(transitionVeil(mk("through"), 0.5)).toBeNull();
  });

  it("cameraOptions y stagger según el tema", () => {
    expect(cameraOptions(neon)).toEqual({ tiltGain: 0.08 });
    expect(cameraOptions(themeFromTokens({}, neutral, { style: { motion: { cameraBlur: false, cameraTilt: 0 } } }))).toEqual({ tiltGain: 0, maxBlur: 0 });
    expect(staggerFrames(neon, 3)).toBe(6);
    expect(staggerFrames(neon, 3, { base: 4 })).toBe(6); // 4 * (2 / 4) * 3
    expect(staggerFrames(neutral, 0)).toBe(0);
    expect(staggerScale(neutral)).toBe(1);
    expect(staggerScale(neon)).toBe(0.5);
  });

  it("fondos: cada tipo produce una capa determinista", () => {
    for (const kind of ["plain", "grid", "dots", "gradient", "noise", "clouds"] as const) {
      const t = themeFromTokens({}, neutral, { style: { background: { kind } } });
      const a = backgroundLayer(t), b = backgroundLayer(t);
      expect(a).toEqual(b);
      expect(a.clouds).toBe(kind === "clouds");
      expect(a.style === undefined).toBe(kind === "plain" || kind === "clouds");
    }
    expect(backgroundLayer(editorial).style?.backgroundSize).toBe("64px 64px");
    expect(backgroundLayer(papel).style?.backgroundImage).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(backgroundLayer(themeFromTokens({}, neutral, { style: { background: { intensity: 0.5 } } })).cloudOpacity).toBe(0.09);
  });

  it("numerales, resalte y acento en cada estilo", () => {
    const mk = (type: object, decor: object = {}) => themeFromTokens({}, neutral, { style: { type, decor } as never });
    expect(numeralStyle(mk({ numerals: "solid" }))).toEqual({ color: c.accent });
    expect(numeralStyle(mk({ numerals: "muted" }))).toEqual({ color: c.textMuted });
    expect(numeralStyle(mk({ numerals: "outline" }))).toMatchObject({ WebkitTextStroke: `2px ${c.accent}` });
    expect(numeralStyle(mk({ numerals: "solid" }), { on: "#3b5bdb" }).color).toBe(c.text); // ningún acento llega a 4,5:1 sobre sí mismo
    expect(highlightStyle(mk({ highlight: "accent" }))).toEqual({ color: c.accent });
    expect(highlightStyle(mk({ highlight: "underline" }), { progress: 0.5 })).toMatchObject({ backgroundSize: "50% 0.09em" });
    expect(highlightStyle(mk({ highlight: "marker" }))).toMatchObject({ backgroundSize: "100% 52%" });
    const mark = (accent: "underline" | "bar" | "dot" | "none") => accentMark(mk({}, { accent }), { length: 100 });
    expect(mark("none")).toBeNull();
    expect(mark("dot")?.style).toMatchObject({ width: 12, height: 12 });
    expect(mark("underline")?.style).toMatchObject({ width: 100, height: 3, background: c.accent });
    expect(textStyle(mk({ eyebrowCase: "upper", eyebrowTracking: 0.1 }), "eyebrow")).toEqual({ textTransform: "uppercase", letterSpacing: "0.1em" });
  });

  it("gráficos: radio, relleno degradado y rayado con ids derivados", () => {
    const mk = (chart: object) => themeFromTokens({}, neutral, { style: { chart } as never });
    expect(chartStyle(mk({ barRadius: "none" })).barRadius).toBe(0);
    expect(chartStyle(mk({ barRadius: "pill" })).barRadius).toBe(999);
    expect(chartFill(mk({ fill: "gradient" }), "#fff", "barras 1")).toMatchObject({ kind: "gradient", id: "ve-fill-barras_1", fill: "url(#ve-fill-barras_1)" });
    expect(chartFill(mk({ fill: "hatched" }), "#336699", "a")).toMatchObject({ kind: "hatched", line: "#336699", angle: 45 });
  });
});

describe("tres design systems de ejemplo", () => {
  it("pasan checkTheme sin reconocimientos y no traen fuentes propias", () => {
    for (const t of [editorial, neon, papel]) {
      expect(checkTheme(t), t.name).toEqual([]);
      expect(t.acknowledge ?? []).toEqual([]);
      expect(t.font.files).toBeUndefined();
      expect(JSON.stringify(t)).not.toMatch(/https?:/);
    }
  });

  it("son estéticas distintas, no la misma con otros colores", () => {
    const sig = (t: typeof neutral) => ({
      card: surfaceStyle(t, "card"),
      title: textStyle(t, "title"),
      eyebrow: textStyle(t, "eyebrow"),
      num: numeralStyle(t, { frame: 10 }),
      bg: backgroundLayer(t).kind,
      motion: t.style.motion,
      decor: t.style.decor,
      story: storyDefaults(t),
      chart: chartStyle(t),
    });
    const sigs = [neutral, editorial, neon, papel].map(sig);
    for (let i = 0; i < sigs.length; i++) for (let j = i + 1; j < sigs.length; j++) {
      for (const k of Object.keys(sigs[i]!) as (keyof ReturnType<typeof sig>)[]) {
        expect(sigs[i]![k], `${k} ${i}/${j}`).not.toEqual(sigs[j]![k]);
      }
    }
    expect(cornerRadius(editorial, "chip")).toBe(0);
    expect(cornerRadius(papel, "chip")).toBe(papel.radius.md);
    expect(cornerRadius(neon, "chip")).toBe(999);
    expect(surfaceStyle(editorial, "card")).toMatchObject({ background: editorial.color.bg, border: `1px solid ${editorial.color.text}` });
    expect(surfaceStyle(editorial, "card").boxShadow).toBeUndefined();
    expect(surfaceStyle(neon, "card").background).toBe(withAlpha(neon.color.surface, 0.72));
    expect(String(surfaceStyle(neon, "card").boxShadow)).toContain("0 0 24px");
    expect(surfaceStyle(papel, "card").background).toMatch(/^#/);
    expect(borderWidth(papel, "chip")).toBe(3);
    expect(borderWidth(editorial, "title")).toBe(1); // con `outline` el cartel lleva su contorno: sin él se confunde con el fondo
  });

  it("el design system llega a las piezas por el proveedor", () => {
    let seen = "";
    const Probe = () => {
      const t = useTheme();
      seen = `${resolveStyle(t).surface.kind}/${t.style.motion.transition}`;
      return null;
    };
    renderToString(<ThemeProvider theme={editorial}><Probe /></ThemeProvider>);
    expect(seen).toBe("outline/wipe");
    renderToString(<ThemeProvider theme={{ ...neutral, style: { surface: { kind: "tinted" } } }}><Probe /></ThemeProvider>);
    expect(seen).toBe("tinted/wash");
    expect(() => renderToString(<ThemeProvider theme={{ ...neutral, style: { surface: { kind: "x" as never } } }}><Probe /></ThemeProvider>)).toThrow(/style no es válido/);
  });
});

describe("cierre del sistema de diseño: ayudas sin trabajos a mano", () => {
  it("borde grueso (`bold`): un píxel más, sin que nadie sume a mano", () => {
    expect(borderWidth(neutral, "card")).toBe(1);
    expect(borderWidth(neutral, "card", { bold: true })).toBe(2);
    expect(surfaceStyle(neutral, "card", { bold: true }).border).toBe(`2px solid ${c.border}`);
    expect(borderWidth(editorial, "card", { bold: true })).toBe(2); // `outline`: el borde es la superficie
    const sinBorde = themeFromTokens({}, neutral, { style: { shape: { outlined: false } } });
    expect(borderWidth(sinBorde, "card", { bold: true })).toBe(0);
  });

  it("esquinas: `corner` pide otro rol y `panel` sigue a radius.panel", () => {
    expect(surfaceStyle(neutral, "card", { corner: "panel" }).borderRadius).toBe(neutral.radius.panel);
    expect(surfaceStyle(neutral, "window").borderRadius).toBe(neutral.radius.lg);
    expect(cornerRadius(papel, "panel")).toBe(papel.radius.panel);
    expect(cornerRadius(editorial, "panel")).toBe(0);
  });

  it("cartel con `outline` lleva borde; la variante del video (`titleCard`) manda sobre la del tema", () => {
    expect(surfaceStyle(editorial, "title").border).toBe(`1px solid ${editorial.color.text}`);
    expect(surfaceStyle(neutral, "title").border).toBeUndefined();
    const vidrio = surfaceStyle(neutral, "title", { titleCard: "glass" });
    expect(vidrio.background).toBe(withAlpha(c.surface, neutral.style!.surface?.opacity ?? 0.74));
    expect(vidrio.border).toBe(`1px solid ${withAlpha(c.surface, 0.9)}`);
  });

  it("`surfaceParts` es lo mismo que `surfaceStyle`, en datos", () => {
    for (const t of [neutral, dark, editorial, neon, papel]) {
      for (const role of ["card", "panel", "window", "headline", "chip", "pill", "title"] as const) {
        const p = surfaceParts(t, role, { glow: 0.5 });
        const css = surfaceStyle(t, role, { glow: 0.5 });
        expect(css.background).toBe(p.fill);
        expect(css.borderRadius).toBe(p.radius);
        expect(css.boxShadow).toBe(p.boxShadow);
        expect(css.border).toBe(p.stroke ? `${+p.stroke.width.toFixed(2)}px solid ${p.stroke.color}` : undefined);
      }
    }
    expect(surfaceParts(neutral, "card").shadow.kind).toBe("soft");
    expect(surfaceParts(editorial, "card").shadow.kind).toBe("none");
    expect(surfaceParts(neon, "card").shadow).toMatchObject({ kind: "glow", blur: 24 });
    const duro = themeFromTokens({}, neutral, { style: { surface: { elevation: "border" } } });
    expect(surfaceParts(duro, "card").shadow).toMatchObject({ kind: "hard", x: 4, y: 4, color: c.text });
    expect(surfaceParts(neutral, "chip", { glow: 1 }).glow).toMatchObject({ blur: 44 });
  });

  it("`entrance` con curva propia (rebote) y traslado extra", () => {
    const lands = (p: number) => 1 + 0.2 * Math.sin(p * Math.PI); // se pasa de 1
    const e = entrance(neutral, 0.5, 0, { native: "rise", distance: -50, curve: lands, round: false });
    expect(e.transform).toBe(`translateY(${+((1 - lands(0.5)) * -50).toFixed(2)}px)`);
    const o = entrance(neutral, 0.5, 0, { native: "rise", distance: -50, curve: lands, round: false, offset: { y: 30 } });
    expect(o.transform).toBe(`translateY(${+((1 - lands(0.5)) * -50 + 30).toFixed(2)}px)`);
    // en reposo solo queda el traslado extra; sin él, nada
    expect(entrance(neutral, 1, 0, { offset: { y: 30 } })).toEqual({ transform: "translateY(30px)" });
    expect(entrance(neutral, 1, 0, { offset: { y: 0 } })).toEqual({});
    // con otra entrada del tema manda el tema (no la curva) y el traslado va delante
    const f = entrance(themeFromTokens({}, neutral, { style: { motion: { entrance: "scale" } } }), 0.5, 0, { curve: lands, offset: { y: 12 } });
    expect(String(f.transform)).toMatch(/^translateY\(12px\) scale\(/);
    // sin opciones nuevas, igual que antes
    expect(entrance(neutral, 0.5, 0, { distance: 24 })).toEqual({ opacity: 0.5, transform: "translateY(12px)" });
  });

  it("rótulo fuerte: un escalón sobre `labelWeight`", () => {
    expect(textStyle(neutral, "label").fontWeight).toBe(neutral.font.weights.medium);
    expect(textStyle(neutral, "label", { strong: true }).fontWeight).toBe(neutral.font.weights.semibold);
    expect(textStyle(neon, "label", { strong: true }).fontWeight).toBe(neon.font.weights.semibold);
    expect(textStyle(papel, "label", { strong: true }).fontWeight).toBe(papel.font.weights.stat);
  });

  it("checkTheme revisa line, solid y text", () => {
    const con = (style: object, color: Partial<typeof neutral.color> = {}) => checkTheme(themeFromTokens({}, { ...neutral, color: { ...neutral.color, ...color } }, { style: style as never }));
    expect(con({}).filter((w) => w.pair.startsWith("style."))).toEqual([]);
    expect(con({ line: { weight: "hairline" } }, { border: "#eeeeee" }).some((w) => w.pair === "style.line.hairline/border" && w.severity === "error")).toBe(true);
    expect(con({ solid: { fill: "outline", edge: "none" } }).some((w) => w.pair === "style.solid.edge/none")).toBe(true);
    expect(con({ solid: { fill: "translucent", edge: "accent" } }, { accent: "#f4f4f4" }).some((w) => w.pair === "style.solid.edge/accent")).toBe(true);
    expect(con({ text: { caret: "block" } }, { onAccent: "#dddddd" }).some((w) => w.pair === "style.text.caret/onAccent")).toBe(true);
    expect(con({ text: { tile: "outline" } }, { text: "#cccccc" }).some((w) => w.pair === "style.text.tile.outline/ink")).toBe(true);
    // un par reconocido baja a nota
    const ack = themeFromTokens({}, { ...neutral, color: { ...neutral.color, border: "#eeeeee" } }, { style: { line: { weight: "hairline" } } as never, acknowledge: ["style.line.hairline/border"] });
    expect(checkTheme(ack).find((w) => w.pair === "style.line.hairline/border")?.severity).toBe("note");
  });

  it("papel: el grano se nota y el texto atenuado sigue pasando", () => {
    const l = backgroundLayer(papel);
    const alpha = Number(/opacity%3D%22([\d.]+)%22/.exec(String(l.style?.backgroundImage))?.[1]);
    expect(alpha).toBeGreaterThanOrEqual(0.12);
    expect(checkTheme(papel)).toEqual([]);
  });
});
