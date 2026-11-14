import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, dark, editorial, neon, neutral, papel } from "../themes";
import type { Theme } from "../themes";
import { Callout, calloutPlacement, calloutState, cameraKeepClear, cameraView, coveredOpacity, headlineStrip, placeBeside, textWidth } from "./index";
import type { Rect } from "./index";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 300 };
const ssr = (el: React.ReactElement, frame: number, theme: Theme = neutral) =>
  renderToString(<FrameProvider frame={frame} config={config}><ThemeProvider theme={theme}>{el}</ThemeProvider></FrameProvider>);
const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("placeBeside", () => {
  const target: Rect = { x: 400, y: 300, w: 300, h: 200 };
  const size = { w: 200, h: 50 };
  it("elige el primer lado libre, en enteros y sin pisar el objetivo", () => {
    const p = placeBeside(target, size);
    expect(p.side).toBe("right");
    expect(p.overlap).toBe(0);
    expect(p.covers).toEqual([]);
    expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
    expect(hit({ x: p.x, y: p.y, ...size }, target)).toBe(false);
  });
  it("esquiva lo que hay que evitar y pasa al siguiente lado", () => {
    const right: Rect = { x: 716, y: 250, w: 400, h: 300 };
    const p = placeBeside(target, size, { avoid: [right] });
    expect(p.side).toBe("below");
    expect(p.covers).toEqual([]);
    expect(hit({ x: p.x, y: p.y, ...size }, right)).toBe(false);
  });
  it("respeta `prefer` y `within`", () => {
    const within = { x: 0, y: 0, w: 1000, h: 560 };
    const p = placeBeside(target, size, { prefer: ["above"], within });
    expect(p.side).toBe("above");
    expect(p.y + size.h).toBeLessThanOrEqual(target.y);
    const edge = placeBeside({ x: 900, y: 100, w: 90, h: 90 }, size, { within, prefer: ["right"] });
    expect(edge.x + size.w).toBeLessThanOrEqual(within.w);
  });
  it("sin lugar libre elige lo que menos pisa y lo informa en `covers`", () => {
    const small: Rect = { x: 0, y: 0, w: 500, h: 400 };
    const t: Rect = { x: 150, y: 150, w: 100, h: 100 };
    const a: Rect = { x: 0, y: 0, w: 500, h: 400 }; // todo cubierto
    const p = placeBeside(t, { w: 120, h: 40 }, { avoid: [a], within: small });
    expect(p.covers).toEqual([0]);
    expect(p.overlap).toBeGreaterThan(0);
    expect(hit({ x: p.x, y: p.y, w: 120, h: 40 }, t)).toBe(false);
  });
  it("es determinista", () => {
    const o = { avoid: [{ x: 716, y: 250, w: 100, h: 100 }], within: { x: 0, y: 0, w: 1920, h: 1080 } };
    expect(placeBeside(target, size, o)).toEqual(placeBeside(target, size, o));
  });
});

describe("calloutState y coveredOpacity", () => {
  it("sube, se sostiene y baja; fuera del rango vale 0", () => {
    const r: [number, number] = [20, 80];
    expect(calloutState(10, r)).toBe(0);
    expect(calloutState(20, r)).toBe(0);
    expect(calloutState(25, r)).toBeGreaterThan(0);
    expect(calloutState(25, r)).toBeLessThan(1);
    expect(calloutState(50, r)).toBe(1);
    expect(calloutState(80, r)).toBe(0);
    expect(calloutState(95, r)).toBe(0);
  });
  it("rango corto: el fundido se acorta y no se sale de 0..1", () => {
    for (let f = 0; f < 30; f++) {
      const p = calloutState(f, [5, 11]);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(calloutState(5, [5, 5])).toBe(0);
  });
  it("lo tapado se apaga con el progreso (y respeta el piso)", () => {
    expect(coveredOpacity(0)).toBe(1);
    expect(coveredOpacity(1)).toBe(0);
    expect(coveredOpacity(0.5)).toBeCloseTo(0.5, 6);
    expect(coveredOpacity(1, 0.3)).toBeCloseTo(0.3, 6);
  });
});

describe("textWidth", () => {
  it("crece con el tamaño y con el texto, y es determinista", () => {
    const a = textWidth(neutral, "Hola mundo", { size: 24 });
    expect(a).toBeGreaterThan(0);
    expect(textWidth(neutral, "Hola mundo", { size: 48 })).toBeCloseTo(a * 2, 0);
    expect(textWidth(neutral, "Hola mundo, otra vez", { size: 24 })).toBeGreaterThan(a);
    expect(textWidth(neutral, "Hola mundo", { size: 24 })).toBe(a);
  });
  it("el rol aporta las mayúsculas y el interletrado del design system", () => {
    const base = textWidth(editorial, "Resumen", { size: 20 });
    const eyebrow = textWidth(editorial, "Resumen", { size: 20, role: "eyebrow" });
    expect(eyebrow).toBeGreaterThan(base); // eyebrowCase: upper y tracking
  });
});

describe("headlineStrip y cameraKeepClear", () => {
  it("cubre el ancho del cuadro y baja bajo la píldora, en cada design system", () => {
    for (const t of [neutral, dark, editorial, neon, papel]) {
      const s = headlineStrip(t, { width: 1920, height: 1080 });
      expect(s).toMatchObject({ x: 0, y: 0, w: 1920 });
      expect(s.h).toBeGreaterThan(t.safe.y / 2 + t.type.caption);
      expect(headlineStrip(t, { width: 1920 }, { layout: "inline" }).h).toBeLessThan(s.h);
      expect(headlineStrip(t, { width: 1920 }, { size: "sm" }).h).toBeLessThan(s.h);
    }
  });
  it("corre la cámara lo mínimo para que el sujeto quede entero y bajo la franja", () => {
    const format = { width: 1920, height: 1080 };
    const strip = headlineStrip(neutral, format);
    const subject: Rect = { x: 260, y: 80, w: 1400, h: 700 }; // arranca dentro de la franja
    const k = cameraKeepClear({ x: 960, y: 540, scale: 1 }, subject, { strip, format });
    expect(k.fits).toBe(true);
    expect(subject.y - k.y + format.height / 2).toBeGreaterThanOrEqual(strip.h);
    expect(subject.y + subject.h - k.y + format.height / 2).toBeLessThanOrEqual(format.height);
    expect(k.y).toBeLessThan(540);
    // si ya está libre, no se mueve
    const ok = cameraKeepClear({ x: 960, y: 540, scale: 1 }, { x: 260, y: 260, w: 1400, h: 600 }, { strip, format });
    expect(ok).toMatchObject({ x: 960, y: 540, fits: true });
  });
  it("con zoom el titular no está: la franja no rige; si no cabe, lo dice", () => {
    const format = { width: 1920, height: 1080 };
    const strip = headlineStrip(neutral, format);
    const subject: Rect = { x: 700, y: 20, w: 400, h: 300 };
    const zoomed = cameraKeepClear({ x: 900, y: 170, scale: 2 }, subject, { strip, format });
    expect(zoomed.fits).toBe(true);
    const big = cameraKeepClear({ x: 960, y: 540, scale: 1 }, { x: 0, y: 0, w: 1920, h: 1080 }, { strip, format });
    expect(big.fits).toBe(false);
  });
  it("cameraView es el cuadro dividido por la escala", () => {
    expect(cameraView({ x: 960, y: 540, scale: 2 }, { width: 1920, height: 1080 })).toEqual({ x: 480, y: 270, w: 960, h: 540 });
  });
});

describe("Callout", () => {
  const target: Rect = { x: 500, y: 400, w: 300, h: 200 };
  const props = { target, text: "Mirá acá", range: [10, 60] as [number, number] };
  it("no dibuja fuera del rango y dibuja una pastilla con interlínea explícita adentro", () => {
    expect(ssr(<Callout {...props} />, 5)).toBe("");
    const h = ssr(<Callout {...props} />, 30);
    expect(h).toContain("Mirá acá");
    expect(h).toMatch(/line-height:\d+px/);
    expect(h).toMatch(/min-width:\d+px/);
  });
  it("sale del tema (cambia con el design system) y es determinista", () => {
    const a = ssr(<Callout {...props} />, 30, neutral);
    expect(ssr(<Callout {...props} />, 30, neutral)).toBe(a);
    expect(ssr(<Callout {...props} />, 30, neon)).not.toBe(a);
  });
  it("la ubicación esquiva `avoid` y dice qué pisa", () => {
    const theme = neutral;
    const free = calloutPlacement(theme, { target, text: "Mirá acá" });
    expect(free.side).toBe("right");
    const labels: Rect[] = [{ x: 800, y: 300, w: 500, h: 400 }, { x: 400, y: 616, w: 600, h: 120 }, { x: 0, y: 300, w: 480, h: 400 }, { x: 400, y: 280, w: 600, h: 100 }];
    const boxed = calloutPlacement(theme, { target, text: "Mirá acá", avoid: labels, within: { x: 0, y: 0, w: 1920, h: 1080 } });
    expect(boxed.covers.length).toBeGreaterThan(0);
    const clear = calloutPlacement(theme, { target, text: "Mirá acá", avoid: [labels[0]!] });
    expect(clear.covers).toEqual([]);
  });
});
