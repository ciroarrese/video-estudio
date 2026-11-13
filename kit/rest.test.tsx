import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral } from "../themes";
import { CloudBackground, DockedHeadline, Stage, Wash, World, cameraAt, hideFromScale } from "./index";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 300 };
const tree = (el: React.ReactElement, frame: number, cfg = config) => (
  <FrameProvider frame={frame} config={cfg}>
    <ThemeProvider theme={neutral}>{el}</ThemeProvider>
  </FrameProvider>
);
const ssr = (el: React.ReactElement, frame: number, cfg = config) => renderToString(tree(el, frame, cfg));

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});
afterEach(() => {
  document.body.innerHTML = "";
});

function htmlAfter(make: (f: number) => React.ReactElement, before: number[], f: number): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  for (const n of [...before, f]) flushSync(() => root.render(tree(make(n), n)));
  const out = host.innerHTML;
  root.unmount();
  return out;
}

// Cámara quieta en escala 1 durante 30 cuadros y después un zoom (el caso en que el rótulo cambiaba según el historial).
const KEYS = [{ f: 0, x: 960, y: 540, scale: 1 }, { f: 30, x: 960, y: 540, scale: 1 }, { f: 60, x: 400, y: 300, scale: 1.8 }, { f: 90, x: 400, y: 300, scale: 1.8 }];
const Scene = ({ f }: { f: number }) => {
  const cam = cameraAt(f, KEYS);
  return (
    <Stage clouds={false}>
      <World camera={cam} width={1920} height={1080}><div>x</div></World>
      <DockedHeadline index={1} title="Titular" subtitle="Sub" frame={f} start={0} hide={hideFromScale(cam.scale)} />
      <Wash frame={f} range={[70, 85]} />
    </Stage>
  );
};

describe("kit: reposo e historial", () => {
  it("DockedHeadline en reposo no lleva opacity ni transform (cámara en escala 1, hide 0)", () => {
    const rest = ssr(<DockedHeadline index={1} title="t" frame={24} start={0} hide={0} />, 24);
    expect(rest).not.toMatch(/opacity/);
    expect(rest).not.toMatch(/transform/);
    const mid = ssr(<DockedHeadline index={1} title="t" frame={9} start={0} hide={0} />, 9);
    expect(mid).toMatch(/opacity/);
    expect(mid).toMatch(/translateX/);
    const hiding = ssr(<DockedHeadline index={1} title="t" frame={30} start={0} hide={0.5} />, 30);
    expect(hiding).toMatch(/opacity:0\.5/);
  });
  it("el marcado de cada cuadro de una escena con cámara, titular y velo no depende del historial", () => {
    const make = (f: number) => <Scene f={f} />;
    for (const f of [0, 9, 24, 30, 31, 45, 60, 69, 72, 80, 85, 89]) {
      const fresh = htmlAfter(make, [], f);
      for (const before of [[89], [0, 89], [45, 89, 0], [f === 0 ? 1 : 0]]) expect(htmlAfter(make, before, f), `cuadro ${f} tras ${before}`).toBe(fresh);
    }
  });
  it("Wash: marca de velo con su opacidad, y sin opacity cuando ya cerró", () => {
    expect(ssr(<Wash range={[10, 20]} />, 5)).toBe("");
    const mid = ssr(<Wash range={[10, 20]} />, 15);
    expect(mid).toContain('data-qa-veil="0.500"');
    expect(mid).toContain("opacity:0.5");
    const done = ssr(<Wash range={[10, 20]} />, 20);
    expect(done).toContain('data-qa-veil="1.000"');
    expect(done).not.toContain("opacity");
  });
});

describe("kit: Stage en cada formato", () => {
  const spread = (cfg: { width: number; height: number }) => {
    const markup = ssr(<Stage><div /></Stage>, 0, { ...config, ...cfg });
    // posiciones `left`/`top` de las manchas (centro = left + size/2)
    const blobs = [...markup.matchAll(/left:(-?[\d.]+)px;top:(-?[\d.]+)px;width:([\d.]+)px/g)].map((m) => ({ x: +m[1]! + +m[3]! / 2, y: +m[2]! + +m[3]! / 2 }));
    return blobs;
  };
  it("las nubes se reparten en el cuadro del video, no en 1920 x 1080", () => {
    const wide = spread({ width: 1920, height: 1080 });
    const tall = spread({ width: 1080, height: 1920 });
    expect(wide).toHaveLength(6);
    expect(tall).toHaveLength(6);
    // la deriva suma como mucho 120 px en x y 90 en y
    for (const b of tall) { expect(b.x).toBeLessThanOrEqual(1080 + 120); expect(b.y).toBeLessThanOrEqual(1920 + 90); }
    expect(Math.max(...tall.map((b) => b.y))).toBeGreaterThan(1080 + 90); // usa el alto extra
    for (const b of wide) { expect(b.x).toBeLessThanOrEqual(1920 + 120); expect(b.y).toBeLessThanOrEqual(1080 + 90); }
  });
  it("en horizontal queda igual que con 1920 x 1080 explícitos", () => {
    const a = ssr(<Stage><div /></Stage>, 40);
    const b = ssr(<div style={{}}><CloudBackground width={1920} height={1080} /></div>, 40);
    const pick = (m: string) => [...m.matchAll(/left:(-?[\d.]+)px;top:(-?[\d.]+)px/g)].map((x) => x[0]).join("|");
    expect(pick(a)).toBe(pick(b));
  });
});
