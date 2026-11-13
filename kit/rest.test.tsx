import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, dark, editorial, neon, neutral, papel } from "../themes";
import type { Theme } from "../themes";
import { CloudBackground, DockedHeadline, DoodleArrow, DoodleCircle, DoodleUnderline, Eyebrow, GradientText, Highlight, Numeral, Stage, Vignette, Wash, World, cameraAt, hideFromScale, useCameraAt } from "./index";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 300 };
const tree = (el: React.ReactElement, frame: number, cfg = config, theme: Theme = neutral) => (
  <FrameProvider frame={frame} config={cfg}>
    <ThemeProvider theme={theme}>{el}</ThemeProvider>
  </FrameProvider>
);
const ssr = (el: React.ReactElement, frame: number, cfg = config, theme: Theme = neutral) => renderToString(tree(el, frame, cfg, theme));

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
});
afterEach(() => {
  document.body.innerHTML = "";
});

function htmlAfter(make: (f: number) => React.ReactElement, before: number[], f: number, theme: Theme = neutral): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  for (const n of [...before, f]) flushSync(() => root.render(tree(make(n), n, config, theme)));
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

describe("kit: World en reposo", () => {
  const cam = (scale: number, rx = 0) => ({ x: 960, y: 540, scale, rx, ry: 0, blur: 0 });
  const transformDe = (c: ReturnType<typeof cam>) => /transform:([^;"]*)/.exec(ssr(<World camera={c} width={1920} height={1080}><div /></World>, 0))![1]!;
  it("con la cámara quieta en escala 1 y sin inclinación no emite scale(1) ni perspective", () => {
    const t = transformDe(cam(1));
    expect(t).not.toMatch(/scale|perspective|rotate/);
    expect(t).toBe("translate(960px, 540px) translate(-960px, -540px)");
    expect(transformDe(cam(1.0004))).not.toMatch(/scale/);
  });
  it("con zoom o inclinación sí emite esas partes", () => {
    expect(transformDe(cam(1.5))).toContain("scale(1.5)");
    expect(transformDe(cam(1, 10))).toMatch(/perspective\(2400px\) rotateX\(10deg\)/);
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

const TEMAS: [string, Theme][] = [["neutral", neutral], ["dark", dark], ["editorial", editorial], ["neon", neon], ["papel", papel]];

describe.each(TEMAS)("kit con el tema %s", (_n, theme) => {
  const Demo = ({ f }: { f: number }) => {
    const cam = cameraAt(f, KEYS);
    return (
      <Stage>
        <World camera={cam} width={1920} height={1080}>
          <DoodleCircle id="a" frame={f} start={0} end={40} cx={100} cy={100} rx={50} ry={30} />
          <DoodleArrow id="b" frame={f} start={0} end={40} x1={0} y1={0} x2={200} y2={100} />
          <DoodleUnderline id="c" frame={f} start={0} end={40} x={5} y={9} length={300} />
        </World>
        <Vignette amount={0.5} />
        <DockedHeadline index={1} title="Titular" subtitle="Sub" frame={f} start={0} hide={hideFromScale(cam.scale)} />
        <GradientText frame={f}>x</GradientText>
        <Numeral frame={f}>01</Numeral>
        <Highlight frame={f} progress={1}>x</Highlight>
        <Eyebrow>x</Eyebrow>
        <Wash frame={f} range={[70, 85]} />
      </Stage>
    );
  };
  it("el marcado de cada cuadro no depende del historial", () => {
    const make = (f: number) => <Demo f={f} />;
    for (const f of [0, 9, 24, 45, 60, 69, 72, 80, 85, 89]) {
      const fresh = htmlAfter(make, [], f, theme);
      for (const before of [[89], [0, 89], [45, 89, 0]]) expect(htmlAfter(make, before, f, theme), `cuadro ${f} tras ${before}`).toBe(fresh);
    }
  });
  it("en reposo no deja identidades (opacity: 1, scale(1), translate en 0, clip-path)", () => {
    const rest = ssr(<DockedHeadline index={1} title="t" frame={40} start={0} />, 40, config, theme);
    expect(rest).not.toMatch(/opacity|transform|clip-path/);
    const closed = ssr(<Wash range={[10, 20]} />, 30, config, theme);
    expect(closed).not.toMatch(/opacity|clip-path/);
  });
  it("Wash: según la transición, dibuja o no dibuja y conserva data-qa-veil", () => {
    const mid = ssr(<Wash range={[10, 20]} />, 15, config, theme);
    const through = theme.style?.motion?.transition === "through";
    const cut = theme.style?.motion?.transition === "cut";
    if (through || cut) expect(mid).toBe("");
    else expect(mid).toContain('data-qa-veil="0.500"');
    if (!through) expect(ssr(<Wash range={[10, 20]} />, 20, config, theme)).toContain('data-qa-veil="1.000"');
  });
  it("Doodle: sin garabatos con decor.doodles false; con trazo geométrico no tiembla entre sorteos", () => {
    const circle = (f: number) => ssr(<DoodleCircle id="a" frame={f} start={0} cx={100} cy={100} rx={50} ry={30} />, f, config, theme);
    const off = theme.style?.decor?.doodles === false;
    expect(circle(30) === "").toBe(off);
    if (!off && theme.style?.decor?.doodleStroke === "geometric") expect(circle(30)).toBe(circle(33));
  });
  it("Vignette: con decor.vignette 0 no dibuja nada", () => {
    const v = ssr(<Vignette amount={1} />, 0, config, theme);
    expect(v === "").toBe(theme.style?.decor?.vignette === 0);
  });
  it("Stage: la capa de fondo sigue a background.kind en cada formato", () => {
    for (const cfg of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }, { width: 1080, height: 1080 }]) {
      const html = ssr(<Stage><div /></Stage>, 0, { ...config, ...cfg }, theme);
      const kind = theme.style?.background?.kind ?? "clouds";
      expect(html.includes("blur(110px)")).toBe(kind === "clouds");
      expect(html.includes("gradient(") || html.includes("data:image")).toBe(kind !== "clouds" && kind !== "plain");
    }
  });
  it("useCameraAt: el tema pone los valores por defecto y lo explícito gana", () => {
    const keys = [{ f: 0, x: 0, y: 0, scale: 1 }, { f: 10, x: 900, y: 0, scale: 1 }];
    let a: ReturnType<typeof useCameraAt> | undefined, b: ReturnType<typeof useCameraAt> | undefined;
    const P = () => { a = useCameraAt(5, keys); b = useCameraAt(5, keys, { maxBlur: 7, tiltGain: 0.05 }); return null; };
    ssr(<P />, 0, config, theme);
    const plain = cameraAt(5, keys);
    expect(b).toEqual(plain);
    if (theme.style?.motion?.cameraBlur !== false && (theme.style?.motion?.cameraTilt ?? 1) === 1) expect(a).toEqual(plain);
  });
});
