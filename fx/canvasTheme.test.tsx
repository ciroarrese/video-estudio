import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral, parseColor } from "../themes";
import type { Theme } from "../themes";
import {
  CubeFold, CubeStack, Globe, Helix, IsoCity, LayerExplode, OrbitRings, ParticleSphere, PhoneOrbit, TerrainMesh, TorusWire, Tunnel, WaveDots,
} from "./three";
import { TypeRing } from "./text";
import { LiquidBlob } from "./art";

/**
 * Tema centinela para lo que se dibuja en canvas: `renderToString` deja los canvas vacíos, así que acá se usa un contexto
 * 2D falso que registra cada color asignado (fillStyle, strokeStyle, shadowColor y paradas de degradado).
 * Los centinelas son azulados y crecientes (r < g < b con saltos de al menos 20), de modo que cualquier color derivado
 * con `mix`/`withAlpha` (combinación convexa) cae dentro de su caja y de esos dos semiespacios, y un color fijo
 * (negro, blanco, grises, rojos, etc.) queda afuera.
 */
const SENT = Array.from({ length: 13 }, (_, i) => {
  const r = 20 + i * 9, g = r + 25 + (i % 3) * 7, b = g + 25 + (i % 4) * 5;
  return { r, g, b };
});
const rgb = (c: { r: number; g: number; b: number }) => `rgb(${c.r}, ${c.g}, ${c.b})`;
const sentinel: Theme = {
  ...neutral,
  name: "centinela",
  color: {
    bg: rgb(SENT[0]!), surface: rgb(SENT[1]!), surfaceAlt: rgb(SENT[2]!), text: rgb(SENT[3]!), textMuted: rgb(SENT[4]!), border: rgb(SENT[5]!),
    accent: rgb(SENT[6]!), accent2: rgb(SENT[7]!), onAccent: rgb(SENT[8]!), success: rgb(SENT[9]!), warning: rgb(SENT[10]!), danger: rgb(SENT[11]!),
    chart: [rgb(SENT[12]!), rgb(SENT[2]!)],
  },
};
const lo = { r: Math.min(...SENT.map((c) => c.r)), g: Math.min(...SENT.map((c) => c.g)), b: Math.min(...SENT.map((c) => c.b)) };
const hi = { r: Math.max(...SENT.map((c) => c.r)), g: Math.max(...SENT.map((c) => c.g)), b: Math.max(...SENT.map((c) => c.b)) };
const gapRG = Math.min(...SENT.map((c) => c.g - c.r)), gapGB = Math.min(...SENT.map((c) => c.b - c.g));
const TOL = 1.6; // redondeo de mix()

function derived(color: string): string | null {
  const c = parseColor(color);
  if (!c) return `no se pudo leer "${color}"`;
  const ok =
    c.r >= lo.r - TOL && c.r <= hi.r + TOL && c.g >= lo.g - TOL && c.g <= hi.g + TOL && c.b >= lo.b - TOL && c.b <= hi.b + TOL &&
    c.g - c.r >= gapRG - 2 * TOL && c.b - c.g >= gapGB - 2 * TOL;
  return ok ? null : `${color} no sale del tema centinela`;
}

function recorder() {
  const colors: string[] = [];
  const pixels: Uint8ClampedArray[] = [];
  const grad = { addColorStop: (_o: number, c: string) => void colors.push(c) };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k: string) => {
      if (k in t) return t[k];
      if (k === "createRadialGradient" || k === "createLinearGradient") return () => grad;
      if (k === "createImageData") return (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === "putImageData") return (img: { data: Uint8ClampedArray }) => void pixels.push(img.data);
      if (k === "measureText") return (s: string) => ({ width: s.length * 10 });
      return () => undefined;
    },
    set: (t, k: string, v) => {
      t[k] = v;
      if (k === "fillStyle" || k === "strokeStyle" || k === "shadowColor") {
        if (typeof v === "string") colors.push(v);
        else if (v !== grad) colors.push(`valor no textual en ${k}`);
      }
      return true;
    },
  });
  return { ctx, colors, pixels };
}

let current: ReturnType<typeof recorder>;
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => current.ctx) as never);
});
afterEach(() => vi.restoreAllMocks());

const config = { fps: 30, width: 1920, height: 1080, durationInFrames: 400 };
function draw(el: (p: { frame: number }) => React.ReactElement, frame: number) {
  current = recorder();
  const { unmount } = render(
    <ThemeProvider theme={sentinel}><FrameProvider frame={frame} config={config}>{el({ frame })}</FrameProvider></ThemeProvider>,
  );
  const out = { colors: [...current.colors], pixels: [...current.pixels] };
  unmount();
  return out;
}

const CASES: [string, (p: { frame: number }) => React.ReactElement][] = [
  ["Globe", (p) => <Globe width={500} height={500} {...p} />],
  ["ParticleSphere", (p) => <ParticleSphere width={500} height={500} {...p} />],
  ["CubeStack", (p) => <CubeStack width={500} height={500} {...p} />],
  ["CubeFold", (p) => <CubeFold width={500} height={500} {...p} />],
  ["Tunnel", (p) => <Tunnel width={600} height={400} {...p} />],
  ["TerrainMesh", (p) => <TerrainMesh width={600} height={400} {...p} />],
  ["TorusWire", (p) => <TorusWire width={500} height={500} {...p} />],
  ["Helix", (p) => <Helix width={400} height={500} {...p} />],
  ["OrbitRings", (p) => <OrbitRings width={500} height={500} {...p} />],
  ["WaveDots", (p) => <WaveDots width={600} height={400} {...p} />],
  ["LayerExplode", (p) => <LayerExplode width={800} height={500} {...p} />],
  ["IsoCity", (p) => <IsoCity width={600} height={400} {...p} />],
  ["PhoneOrbit", (p) => <PhoneOrbit width={500} height={500} {...p} />],
  ["PhoneOrbit con pantalla", (p) => <PhoneOrbit width={500} height={500} {...p}><div /></PhoneOrbit>],
  ["TypeRing", (p) => <TypeRing text="Texto" width={600} height={400} {...p} />],
];

describe("canvas: todo color sale del tema (tema centinela)", () => {
  it("el verificador distingue colores fijos de derivados", () => {
    expect(derived(rgb(SENT[3]!))).toBeNull();
    expect(derived("#ffffff")).not.toBeNull();
    expect(derived("rgb(0, 0, 0)")).not.toBeNull();
    expect(derived("rgba(128, 128, 128, 0.5)")).not.toBeNull();
    expect(derived("rgb(255, 80, 20)")).not.toBeNull();
  });
  describe.each(CASES)("%s", (_name, el) => {
    it("cada fillStyle, strokeStyle, shadowColor y parada de degradado es un centinela o derivado de uno", () => {
      let seen = 0;
      for (const f of [0, 20, 45, 75, 150]) {
        for (const c of draw(el, f).colors) {
          seen++;
          expect(derived(c), `cuadro ${f}`).toBeNull();
        }
      }
      expect(seen).toBeGreaterThan(0);
    });
  });
  it("LiquidBlob: los píxeles del campo salen de accent y accent2", () => {
    const A = parseColor(sentinel.color.accent)!, B = parseColor(sentinel.color.accent2)!;
    const { pixels } = draw((p) => <LiquidBlob width={120} height={80} {...p} />, 100);
    expect(pixels.length).toBeGreaterThan(0);
    let opaque = 0;
    for (const data of pixels) for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      opaque++;
      for (const [k, a, b] of [[0, A.r, B.r], [1, A.g, B.g], [2, A.b, B.b]] as const) {
        const v = data[i + k]!;
        expect(v).toBeGreaterThanOrEqual(Math.floor(Math.min(a, b) * 0.9));
        expect(v).toBeLessThanOrEqual(Math.max(a, b));
      }
    }
    expect(opaque).toBeGreaterThan(0);
  });
});
