import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { FrameProvider } from "../../engine";
import { ThemeProvider, dark, neutral } from "../../themes";
import {
  CardFlip, CarouselRing, CubeFold, CubeStack, ExtrudeType, Globe, Helix, IsoCity, LayerExplode, OrbitRings,
  ParticleSphere, PhoneOrbit, TerrainMesh, TorusWire, Tunnel, WaveDots,
} from "./index";

// Contexto 2D falso que registra cada llamada y cada propiedad asignada.
function recorder() {
  const log: string[] = [];
  const fmt = (v: unknown) => (typeof v === "number" ? v.toFixed(3) : typeof v === "object" ? "[obj]" : String(v));
  const grad = { addColorStop: (...a: unknown[]) => void log.push("stop " + a.map(fmt).join(",")) };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, k: string) => {
      if (k === "createRadialGradient" || k === "createLinearGradient") return (...a: unknown[]) => { log.push(k + a.map(fmt).join(",")); return grad; };
      return (...a: unknown[]) => void log.push(k + " " + a.map(fmt).join(","));
    },
    set: (_t, k: string, v) => { log.push("set " + k + "=" + fmt(v)); return true; },
  });
  return { ctx, log };
}

let current: ReturnType<typeof recorder>;
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => (current = current ?? recorder()).ctx) as never);
});
afterEach(() => vi.restoreAllMocks());

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
  ["CardFlip", (p) => <CardFlip width={600} height={400} {...p} />],
  ["CarouselRing", (p) => <CarouselRing width={800} height={400} {...p} />],
  ["IsoCity", (p) => <IsoCity width={600} height={400} {...p} />],
  ["ExtrudeType", (p) => <ExtrudeType width={800} height={300} {...p} />],
  ["PhoneOrbit", (p) => <PhoneOrbit width={500} height={500} {...p} />],
];

/** Dibuja el elemento en `frame` y devuelve el registro de llamadas y el HTML. */
function snap(el: (p: { frame: number }) => React.ReactElement, frame: number, theme = neutral) {
  current = recorder();
  const { container, unmount } = render(
    <ThemeProvider theme={theme}>
      <FrameProvider frame={frame} config={{ fps: 30, width: 1920, height: 1080, durationInFrames: 200 }}>{el({ frame })}</FrameProvider>
    </ThemeProvider>,
  );
  const out = { calls: current.log.join("\n"), html: container.innerHTML };
  unmount();
  return out;
}

describe.each(CASES)("%s", (_name, el) => {
  it("se dibuja sin errores en el primero, el medio y el último cuadro, con los dos temas", () => {
    for (const theme of [neutral, dark]) for (const f of [0, 37, 75, 200]) {
      expect(() => snap(el, f, theme)).not.toThrow();
    }
  });
  it("es pura: el mismo cuadro da las mismas llamadas, también después de otros cuadros", () => {
    const a = snap(el, 41);
    snap(el, 3); snap(el, 90);
    const b = snap(el, 41);
    expect(b.calls).toBe(a.calls);
    expect(b.html).toBe(a.html);
  });
  it("el último cuadro es un still: no cambia después de la duración", () => {
    const a = snap(el, 75), b = snap(el, 140);
    expect(b.calls).toBe(a.calls);
    expect(b.html).toBe(a.html);
  });
});

describe("colores del tema", () => {
  it("los dos temas dan dibujos distintos", () => {
    const a = snap((p) => <Globe width={400} height={400} {...p} />, 60, neutral);
    const b = snap((p) => <Globe width={400} height={400} {...p} />, 60, dark);
    expect(a.calls).not.toBe(b.calls);
  });
});
