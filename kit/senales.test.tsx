import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider, useFormat, useFrame, useVideoConfig } from "../engine";
import { ThemeProvider, editorial, mergeStyleInput, neon, neutral, papel, resolveTheme } from "../themes";
import type { Theme } from "../themes";
import { Callout, CloudBackground, DoodleArrow, FlyingCard, FocusGroup, NestedScene, Stage } from "./index";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 300 };
const html = (node: React.ReactNode, theme: Theme, frame: number, cfg = config) =>
  renderToString(<FrameProvider frame={frame} config={cfg}><ThemeProvider theme={theme}>{node}</ThemeProvider></FrameProvider>);

const withMark = (t: Theme, mark: "focus"): Theme => ({ ...t, style: mergeStyleInput(t.style, { annotation: { mark } }) });
const RANGE: [number, number] = [20, 90];

describe("FocusGroup", () => {
  it("con una señal que no es focus no emite opacity ni marca: se puede dejar puesto siempre", () => {
    for (const t of [neutral, editorial, neon, papel]) for (const f of [0, 30, 60, 100]) {
      const out = html(<FocusGroup range={RANGE}><b>x</b></FocusGroup>, t, f);
      expect(out, `${t.name} ${f}`).not.toMatch(/opacity|data-qa-focus/);
    }
  });
  it("con focus atenúa a 1 - dim mientras la señal está y vuelve sin dejar residuo", () => {
    const t = withMark(neutral, "focus");
    const mid = html(<FocusGroup range={RANGE}><b>x</b></FocusGroup>, t, 50);
    expect(mid).toContain("opacity:0.45");
    expect(mid).toContain('data-qa-focus="0.45"');
    expect(html(<FocusGroup range={RANGE}><b>x</b></FocusGroup>, t, 5)).not.toMatch(/opacity/);
    expect(html(<FocusGroup range={RANGE}><b>x</b></FocusGroup>, t, 120)).not.toMatch(/opacity/);
    const half = html(<FocusGroup range={RANGE}><b>x</b></FocusGroup>, t, 25);
    expect(half).toMatch(/opacity:0\.7/);
  });
  it("variant fuerza focus aunque el tema señale con otra cosa", () => {
    expect(html(<FocusGroup range={RANGE} variant="focus"><b>x</b></FocusGroup>, editorial, 50)).toContain("opacity:");
  });
  it("el marcado no depende del historial", () => {
    const node = <FocusGroup range={RANGE} variant="focus"><b>x</b></FocusGroup>;
    const seq = [50, 5, 25, 120, 50];
    const a = seq.map((f) => html(node, neutral, f));
    expect(a[0]).toBe(a[4]);
  });
});

describe("señales declaradas al control de calidad", () => {
  it("DoodleArrow lleva su pieza y la señal del tema", () => {
    const out = html(<DoodleArrow id="a" start={0} x1={0} y1={0} x2={100} y2={100} />, neutral, 40);
    expect(out).toContain('data-ve-signal="doodle"');
    expect(out).toContain('data-ve-piece="DoodleArrow"');
    expect(out).toContain('data-ve-mark="arrow"');
  });
  it("Callout marca la excepción forzada solo si difiere del tema", () => {
    const target = { x: 100, y: 100, w: 200, h: 100 };
    const normal = html(<Callout target={target} text="Acá" range={[0, 80]} />, neutral, 40);
    expect(normal).toContain('data-ve-piece="Callout"');
    expect(normal).not.toContain("data-ve-forced");
    expect(html(<Callout target={target} text="Acá" range={[0, 80]} variant="ring" />, neutral, 40)).toContain('data-ve-forced="true"');
    expect(html(<Callout target={target} text="Acá" range={[0, 80]} variant="arrow" />, neutral, 40)).not.toContain("data-ve-forced");
  });
});

describe("CloudBackground drift", () => {
  const pos = (f: number, drift?: number) => html(<CloudBackground drift={drift} />, neutral, f);
  it("con drift 1 (o sin él) el movimiento es el de siempre", () => {
    for (const f of [0, 50, 300]) expect(pos(f, 1)).toBe(pos(f, undefined));
  });
  it("con drift 0 las nubes quedan quietas; con más, con más se mueven distinto que con 1", () => {
    expect(pos(0, 0)).toBe(pos(250, 0));
    const left = (s: string) => [...s.matchAll(/left:(-?[\d.]+)px/g)].map((m) => Number(m[1]));
    const d = (drift: number) => left(pos(200, drift)).reduce((s, v, i) => s + Math.abs(v - left(pos(0, drift))[i]!), 0);
    expect(d(0)).toBe(0);
    expect(d(1)).toBeGreaterThan(0);
    expect(d(3)).not.toBeCloseTo(d(1), 0);
  });
  it("el drift sale del tema (style.background.drift) y una escena lo pisa", () => {
    const t = resolveTheme({ ...neutral, style: mergeStyleInput(neutral.style, { background: { drift: 0 } }) });
    expect(html(<CloudBackground />, t, 0)).toBe(html(<CloudBackground />, t, 250));
    expect(html(<CloudBackground drift={1} />, t, 0)).not.toBe(html(<CloudBackground drift={1} />, t, 250));
    expect(html(<Stage cloud={{ drift: 2 }}><i /></Stage>, neutral, 10)).toContain("left:");
  });
});

describe("FlyingCard con giro y tamaño", () => {
  const card = (f: number, extra = {}) => html(<FlyingCard range={[10, 50]} from={{ x: 200, y: 200 }} to={{ x: 800, y: 400 }} width={200} height={100} {...extra}><i /></FlyingCard>, neutral, f);
  it("sin rotate ni toWidth es el de siempre", () => {
    expect(card(30)).not.toMatch(/rotate/);
    expect(card(60)).not.toMatch(/transform/);
  });
  it("gira de un ángulo a otro con la curva del vuelo y llega al ángulo final", () => {
    expect(card(30, { rotate: [0, 10] })).toMatch(/rotate\(5deg\)/);
    expect(card(60, { rotate: [0, 10] })).toMatch(/rotate\(10deg\)/);
    expect(card(60, { rotate: 0 })).not.toMatch(/rotate/);
  });
  it("cambia de tamaño y queda centrada en su punto", () => {
    const mid = card(30, { toWidth: 400, toHeight: 200 });
    expect(mid).toMatch(/width:300px;height:150px/);
    const end = card(60, { toWidth: 400, toHeight: 200 });
    expect(end).toMatch(/left:600px;top:300px;width:400px;height:200px/);
  });
});

describe("NestedScene", () => {
  const Probe = () => { const f = useFrame(); const c = useVideoConfig(); const fm = useFormat(); return <i data-f={f} data-w={c.width} data-h={c.height} data-fmt={fm.format} />; };
  it("la escena ve su cuadro local y su formato, escalada con una sola scale", () => {
    const out = html(<NestedScene scene={Probe} start={100} width={480} format="vertical" />, neutral, 130);
    expect(out).toContain('data-f="30"');
    expect(out).toContain('data-w="1080"');
    expect(out).toContain('data-h="1920"');
    expect(out).toContain('data-fmt="vertical"');
    expect(out).toMatch(/text-rendering:geometricPrecision/);
    expect(out).toMatch(/transform:scale\(0\.4444\)/);
    expect(out).toContain("data-qa-decor");
  });
  it("antes de start está en su cuadro 0; con frame queda fija; con qa={false} no lleva marcas", () => {
    expect(html(<NestedScene scene={Probe} start={100} scale={0.5} />, neutral, 20)).toContain('data-f="0"');
    expect(html(<NestedScene scene={Probe} frame={42} scale={0.5} />, neutral, 200)).toContain('data-f="42"');
    expect(html(<NestedScene scene={Probe} scale={0.5} qa={false} />, neutral, 0)).not.toContain("data-qa");
  });
  it("sin scale, width ni height falla con un mensaje claro", () => {
    expect(() => html(<NestedScene scene={Probe} />, neutral, 0)).toThrow(/scale/);
  });
  it("con escala 1 no emite scale(1)", () => {
    expect(html(<NestedScene scene={Probe} scale={1} />, neutral, 0)).not.toMatch(/scale\(/);
  });
});
