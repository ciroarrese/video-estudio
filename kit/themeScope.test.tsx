import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { FrameProvider, pendingHolds } from "../engine";
import { ThemeProvider, neutral, parseColor, useTheme, checkTheme, dark } from "../themes";
import type { Theme } from "../themes";
import { Cursor, Stage, ThemeScope } from "./index";
import { ParticleSphere } from "../fx/three";
import { DonutRing } from "../fx";
import { ThemeScopeDemo } from "../examples/theme-scope/ThemeScopeDemo";

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 130 };
const rgb = (r: number, g: number, b: number) => `rgb(${r}, ${g}, ${b})`;

/** Tema centinela: `warm` = rojizo (r > g > b), si no azulado (r < g < b); cada rol con un valor propio. */
function sentinel(name: string, warm: boolean, font: string, files?: Theme["font"]["files"]): Theme {
  const c = (i: number) => (warm ? rgb(230 - i * 6, 90 - i * 3, 20 + (i % 3)) : rgb(20 + (i % 3), 90 - i * 3 + 20, 230 - i * 6));
  return {
    ...neutral,
    name,
    color: {
      bg: c(0), surface: c(1), surfaceAlt: c(2), text: c(3), textMuted: c(4), border: c(5), accent: c(6), accent2: c(7), onAccent: c(8),
      success: c(9), warning: c(10), danger: c(11), chart: [c(12), c(13)],
    },
    gradient: { brand: `linear-gradient(90deg, ${c(14)}, ${c(15)})` },
    font: { ...neutral.font, family: `"${font}", serif`, files },
    cloud: { colors: [c(16), c(17)], opacity: 0.5 },
  };
}
const OUTER = sentinel("exterior", true, "FuenteExterior");
const INNER = sentinel("interior", false, "FuenteInterior");
const colorsOf = (t: Theme) => [...Object.values(t.color).flat(), ...t.cloud.colors] as string[];

const html = (node: React.ReactNode, frame = 10) =>
  renderToString(<FrameProvider frame={frame} config={config}><ThemeProvider theme={OUTER}>{node}</ThemeProvider></FrameProvider>);
const has = (markup: string, t: Theme) => colorsOf(t).some((c) => markup.includes(c));

const Probe = ({ id }: { id: string }) => {
  const t = useTheme();
  return <i id={id} style={{ color: t.color.text, background: t.color.accent, fontFamily: t.font.family }} />;
};

describe("ThemeScope: DOM", () => {
  it("lo de adentro toma el tema del ámbito y lo de afuera sigue con el exterior", () => {
    const out = html(<><Probe id="fuera" /><ThemeScope theme={INNER}><Probe id="dentro" /></ThemeScope><Probe id="despues" /></>);
    const piece = (id: string) => new RegExp(`<i id="${id}"[^>]*>`).exec(out)![0];
    expect(piece("fuera")).toContain(OUTER.color.text);
    expect(piece("fuera")).not.toContain(INNER.color.text);
    expect(piece("dentro")).toContain(INNER.color.text);
    expect(piece("dentro")).toContain("FuenteInterior");
    expect(piece("dentro")).not.toContain(OUTER.color.text);
    expect(piece("despues")).toContain(OUTER.color.text);
  });
  it("anida: tres niveles, cada uno ve el suyo", () => {
    const third = sentinel("tercero", false, "FuenteTercera");
    const out = html(
      <ThemeScope theme={INNER}><Probe id="a" /><ThemeScope theme={third}><Probe id="b" /></ThemeScope><Probe id="c" /></ThemeScope>,
    );
    const piece = (id: string) => new RegExp(`<i id="${id}"[^>]*>`).exec(out)![0];
    expect(piece("a")).toContain("FuenteInterior");
    expect(piece("b")).toContain("FuenteTercera");
    expect(piece("c")).toContain("FuenteInterior");
  });
  it("sin `paint` no agrega elementos; con `paint` pinta fondo, texto y tipografía del ámbito", () => {
    const plain = html(<ThemeScope theme={INNER}><b>x</b></ThemeScope>);
    expect(plain).toBe(html(<b>x</b>));
    const painted = html(<ThemeScope theme={INNER} paint style={{ width: 10 }}><b>x</b></ThemeScope>);
    expect(painted).toContain(`background:${INNER.color.bg}`);
    expect(painted).toContain(`color:${INNER.color.text}`);
    expect(painted).toContain("FuenteInterior");
    expect(painted).toContain("width:10px");
    expect(has(painted, OUTER)).toBe(false);
  });
  it("Stage y piezas del kit dentro del ámbito usan solo el tema interior", () => {
    const out = html(
      <ThemeScope theme={INNER}>
        <Stage><Cursor keys={[[0, 5, 5], [20, 50, 50]]} clicks={[10]} show={[0, 60]} /></Stage>
      </ThemeScope>,
    );
    expect(has(out, INNER)).toBe(true);
    expect(has(out, OUTER)).toBe(false);
  });
  it("un efecto de fx en SVG dentro del ámbito usa el tema interior", () => {
    const inside = html(<ThemeScope theme={INNER}><DonutRing frame={40} start={0} duration={60} width={300} height={300} /></ThemeScope>, 40);
    expect(has(inside, INNER)).toBe(true);
    expect(has(inside, OUTER)).toBe(false);
    const outside = html(<DonutRing frame={40} start={0} duration={60} width={300} height={300} />, 40);
    expect(has(outside, OUTER)).toBe(true);
    expect(has(outside, INNER)).toBe(false);
  });
  it("la demo: cada color aparece solo en su ámbito", () => {
    const only = (props: { theme: Theme; scoped: Theme; inner: Theme }) =>
      renderToString(<FrameProvider frame={90} config={config}><ThemeScopeDemo {...props} /></FrameProvider>);
    const third = sentinel("tercero", false, "FuenteTercera");
    // Interior = INNER, anidado = OUTER: la demo mezcla los dos, y cada uno tiene que aparecer.
    const mixed = only({ theme: OUTER, scoped: INNER, inner: OUTER });
    expect(has(mixed, OUTER)).toBe(true);
    expect(has(mixed, INNER)).toBe(true);
    expect(mixed).toContain("FuenteInterior");
    // Sin ámbito distinto, un solo tema en todo el árbol.
    const single = only({ theme: OUTER, scoped: OUTER, inner: OUTER });
    expect(has(single, OUTER)).toBe(true);
    expect(has(single, INNER)).toBe(false);
    expect(has(single, third)).toBe(false);
  });
  it("checkTheme se corre por tema: cada ámbito tiene su propio informe", () => {
    expect(Array.isArray(checkTheme(dark))).toBe(true);
    expect(checkTheme(INNER)).not.toEqual(checkTheme(neutral));
  });
});

// --- canvas: contexto 2D falso que registra los colores ---
function recorder() {
  const colors: string[] = [];
  const grad = { addColorStop: (_o: number, c: string) => void colors.push(c) };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => {
      if (k in t) return t[k];
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => grad;
      if (k === "measureText") return (s: string) => ({ width: s.length * 10 });
      return () => undefined;
    },
    set: (t, k: string, v) => {
      t[k] = v;
      if ((k === "fillStyle" || k === "strokeStyle" || k === "shadowColor") && typeof v === "string") colors.push(v);
      return true;
    },
  });
  return { ctx, colors };
}

describe("ThemeScope: canvas", () => {
  let rec: ReturnType<typeof recorder>;
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => rec.ctx) as never);
  });
  afterEach(() => vi.restoreAllMocks());

  const drawColors = (node: React.ReactNode) => {
    rec = recorder();
    const { unmount } = render(<FrameProvider frame={40} config={config}><ThemeProvider theme={OUTER}>{node}</ThemeProvider></FrameProvider>);
    unmount();
    return rec.colors.map((c) => parseColor(c)!).filter(Boolean);
  };

  it("el canvas dentro del ámbito dibuja solo con el interior (azulado) y el de afuera con el exterior (rojizo)", () => {
    const inside = drawColors(<ThemeScope theme={INNER}><ParticleSphere frame={40} width={300} height={300} /></ThemeScope>);
    const outside = drawColors(<ParticleSphere frame={40} width={300} height={300} />);
    expect(inside.length).toBeGreaterThan(0);
    expect(outside.length).toBeGreaterThan(0);
    for (const c of inside) expect(c.b, `interior ${JSON.stringify(c)}`).toBeGreaterThan(c.r);
    for (const c of outside) expect(c.r, `exterior ${JSON.stringify(c)}`).toBeGreaterThan(c.b);
  });
  it("los dos canvas conviven en el mismo árbol sin mezclarse", () => {
    const both = drawColors(
      <>
        <ParticleSphere frame={40} width={300} height={300} />
        <ThemeScope theme={INNER}><ParticleSphere frame={40} width={300} height={300} /></ThemeScope>
      </>,
    );
    expect(both.some((c) => c.b > c.r)).toBe(true);
    expect(both.some((c) => c.r > c.b)).toBe(true);
  });
});

// --- fuentes ---
describe("ThemeScope: fuentes del tema anidado", () => {
  const fonts = { load: vi.fn<(f: string) => Promise<unknown>>(), check: vi.fn(() => false) };
  beforeEach(() => {
    fonts.load.mockReset();
    (document as unknown as { fonts: unknown }).fonts = fonts;
  });
  afterEach(() => {
    delete (document as unknown as { fonts?: unknown }).fonts;
  });

  it("declara el @font-face y frena la captura hasta que la fuente carga", async () => {
    let done!: () => void;
    fonts.load.mockReturnValue(new Promise<void>((r) => (done = r)));
    const themed = sentinel("conArchivos", false, "FuenteConArchivo", [{ weight: 400, src: "/fuente-a.woff2" }]);
    const { container } = render(<ThemeScope theme={themed}><span>hola</span></ThemeScope>);
    expect(container.innerHTML).toContain("@font-face");
    expect(container.innerHTML).toContain("/fuente-a.woff2");
    expect(fonts.load).toHaveBeenCalledWith(expect.stringContaining("FuenteConArchivo"));
    expect(pendingHolds().some((l) => l.includes("FuenteConArchivo"))).toBe(true);
    await act(async () => { done(); });
    expect(pendingHolds().some((l) => l.includes("FuenteConArchivo"))).toBe(false);
  });
  it("no pide dos veces la misma fuente aunque se re-renderice", async () => {
    fonts.load.mockResolvedValue(undefined);
    const themed = sentinel("conArchivos2", false, "FuenteUnaVez", [{ weight: 400, src: "/fuente-b.woff2" }]);
    const r = render(<ThemeScope theme={themed}>x</ThemeScope>);
    await act(async () => {});
    r.rerender(<ThemeScope theme={themed}>y</ThemeScope>);
    await act(async () => {});
    expect(fonts.load).toHaveBeenCalledTimes(1);
    expect(pendingHolds().some((l) => l.includes("FuenteUnaVez"))).toBe(false);
  });
  it("si la carga falla igual se libera la captura", async () => {
    fonts.load.mockRejectedValue(new Error("no"));
    const themed = sentinel("conArchivos3", false, "FuenteRota", [{ weight: 400, src: "/fuente-c.woff2" }]);
    render(<ThemeScope theme={themed}>x</ThemeScope>);
    await act(async () => {});
    expect(pendingHolds().some((l) => l.includes("FuenteRota"))).toBe(false);
  });
  it("sin archivos de fuente no hay nada que esperar", () => {
    render(<ThemeScope theme={sentinel("sinArchivos", false, "FuenteSistema")}>x</ThemeScope>);
    expect(fonts.load).not.toHaveBeenCalled();
  });
});
