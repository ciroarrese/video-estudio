import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neon, neutral } from "../themes";
import type { Theme } from "../themes";
import {
  Callout, DataCard, ProgressBar, StepFrame, World, calloutDecision, calloutPlacement, cameraAt, cameraView, decideBeside, dataCardDecision, guidedCameraKeys, guidedCameraPlan,
  guidedSettledAt, placeBeside, projectPoint, projectRect, stepProgress, useCameraAt,
} from "./index";
import type { GuidedCameraOptions, Rect, StepSignal } from "./index";

const FORMAT = { width: 1920, height: 1080 };
const config = { fps: 30, ...FORMAT, durationInFrames: 300 };
const ssr = (el: React.ReactElement, frame: number, theme: Theme = neutral) =>
  renderToString(<FrameProvider frame={frame} config={config}><ThemeProvider theme={theme}>{el}</ThemeProvider></FrameProvider>);
const dom = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
};

const A: Rect = { x: 300, y: 400, w: 400, h: 120 };
const B: Rect = { x: 1200, y: 700, w: 300, h: 90 };
const BASE: GuidedCameraOptions = {
  overview: { x: 960, y: 540 }, zoom: { in: 1.8 }, format: FORMAT,
  signals: [{ id: "a", target: A, start: 20, duration: 60 }, { id: "b", target: B, start: 100, duration: 60 }],
};

describe("cámara guiada por focos", () => {
  it("arranca en la vista general y centra cada objetivo", () => {
    const { keys, stops } = guidedCameraPlan(BASE);
    expect(keys[0]).toEqual({ f: 0, x: 960, y: 540, scale: 1 });
    for (const [i, t] of [A, B].entries()) {
      const s = stops[i]!;
      expect(s.key.x).toBe(t.x + t.w / 2);
      expect(s.key.y).toBe(t.y + t.h / 2);
      // en el cuadro de llegada el centro del objetivo cae en el centro del cuadro
      const cam = cameraAt(s.arrive, keys, { profile: "plana" });
      const r = projectRect(t, cam, FORMAT);
      expect(r.x + r.w / 2).toBeCloseTo(960, 6);
      expect(r.y + r.h / 2).toBeCloseTo(540, 6);
    }
  });

  it("llega 14 cuadros después del inicio y viaja en 22 (por defecto)", () => {
    const { keys, stops } = guidedCameraPlan(BASE);
    expect(stops[0]!.arrive).toBe(20 + 14);
    expect(stops[1]!.arrive).toBe(100 + 14);
    // la cámara se queda quieta en la vista general hasta salir (34 - 22 = 12) y no se mueve entre llegar y salir de nuevo
    expect(keys.find((k) => k.f === 12)).toBeDefined();
    expect(cameraAt(5, keys).scale).toBe(1);
    expect(cameraAt(12, keys).scale).toBe(1);
    expect(cameraAt(13, keys).scale).toBeGreaterThan(1);
    expect(cameraAt(34, keys).scale).toBe(1.8);
    expect(stops[0]!.depart).toBe(114 - 22);
    expect(cameraAt(60, keys)).toMatchObject({ x: 500, y: 460, scale: 1.8 });
    expect(cameraAt(92, keys).x).toBe(500);
    expect(cameraAt(93, keys).x).toBeGreaterThan(500);
    expect(cameraAt(114, keys)).toMatchObject({ x: 1350, y: 745, scale: 1.8 });
  });

  it("respeta `arrive` y `travel` propios y acorta el viaje si no hay tiempo", () => {
    const p = guidedCameraPlan({ ...BASE, arrive: 10, travel: 8 });
    expect(p.stops.map((s) => s.arrive)).toEqual([30, 110]);
    expect(p.keys.find((k) => k.f === 22)).toBeDefined();
    expect(p.stops[0]!.depart).toBe(102);
    // dos señales casi pegadas: la segunda sale en cuanto llegó la primera (viaje de 5 cuadros)
    const q = guidedCameraPlan({ ...BASE, signals: [{ id: "a", target: A, start: 0, duration: 30 }, { id: "b", target: B, start: 5, duration: 30 }] });
    expect(q.stops[0]!.arrive).toBe(14);
    expect(q.stops[1]!.arrive).toBe(19);
    expect(q.stops[0]!.depart).toBe(14);
  });

  it("limita el zoom solo si el objetivo es más ancho o alto que el área útil", () => {
    const chico = guidedCameraPlan({ ...BASE, signals: [{ id: "a", target: A, start: 0, duration: 40 }] }).stops[0]!;
    expect(chico.key.scale).toBe(1.8);
    expect(chico.fits).toBe(true);
    // 1400 de ancho a 1,8 serían 2520 px: no entra en 1760 (1920 menos 80 de margen por lado)
    const ancho: Rect = { x: 100, y: 300, w: 1400, h: 200 };
    const g = guidedCameraPlan({ ...BASE, zoom: { in: 1.8, out: 0.5 }, signals: [{ id: "g", target: ancho, start: 0, duration: 40 }] }).stops[0]!;
    expect(g.key.scale).toBeLessThan(1.8);
    expect(g.key.scale).toBeCloseTo(1760 / (1400 + 32), 6);
    expect(g.fits).toBe(true);
    // el alto manda cuando es el que no entra
    const alto: Rect = { x: 100, y: 100, w: 200, h: 900 };
    const h = guidedCameraPlan({ ...BASE, zoom: { in: 1.8, out: 0.5 }, signals: [{ id: "h", target: alto, start: 0, duration: 40 }] }).stops[0]!;
    expect(h.key.scale).toBeCloseTo(920 / (900 + 32), 6);
    // no baja de `out`: si ni así entra, lo dice
    const enorme: Rect = { x: 0, y: 0, w: 4000, h: 300 };
    const e = guidedCameraPlan({ ...BASE, signals: [{ id: "e", target: enorme, start: 0, duration: 40 }] }).stops[0]!;
    expect(e.key.scale).toBe(1);
    expect(e.fits).toBe(false);
    // una escala propia gana
    const p = guidedCameraPlan({ ...BASE, signals: [{ id: "p", target: A, start: 0, duration: 40, scale: 2.5 }] }).stops[0]!;
    expect(p.key.scale).toBe(2.5);
  });

  it("acepta paradas a mano y la vuelta a la vista general", () => {
    const p = guidedCameraPlan({ ...BASE, stops: [{ f: 70, x: 800, y: 300, scale: 1.2, id: "plano" }], returnAt: 200 });
    expect(p.stops.map((s) => s.id)).toEqual(["a", "plano", "b", "vista-general"]);
    expect(p.stops.map((s) => s.kind)).toEqual(["signal", "stop", "signal", "overview"]);
    const cam = cameraAt(70, p.keys);
    expect(cam).toMatchObject({ x: 800, y: 300, scale: 1.2 });
    expect(cameraAt(200, p.keys)).toMatchObject({ x: 960, y: 540, scale: 1 });
    // la parada a mano no cuenta como señal asentada
    expect(guidedSettledAt(p, 70)).toBeUndefined();
    expect(guidedSettledAt(p, 120)?.id).toBe("b");
  });

  it("falla con un mensaje claro si dos paradas chocan o una señal no dura", () => {
    expect(() => guidedCameraPlan({ ...BASE, signals: [{ id: "a", target: A, start: 20, duration: 30 }, { id: "b", target: B, start: 20, duration: 30 }] })).toThrow(/"b" llega en el cuadro 34/);
    expect(() => guidedCameraPlan({ ...BASE, signals: [{ id: "a", target: A, start: 20, duration: 0 }] })).toThrow(/"a" tiene que durar/);
  });

  it("`guidedSettledAt` marca asentada solo entre llegar y salir", () => {
    const p = guidedCameraPlan(BASE);
    expect(guidedSettledAt(p, 10)).toBeUndefined();
    expect(guidedSettledAt(p, 33)).toBeUndefined();
    expect(guidedSettledAt(p, 34)?.id).toBe("a");
    expect(guidedSettledAt(p, 92)?.id).toBe("a");
    expect(guidedSettledAt(p, 93)).toBeUndefined();
    expect(guidedSettledAt(p, 150)?.id).toBe("b");
    expect(guidedCameraKeys(BASE)).toEqual(p.keys);
  });
});

describe("perfil de cámara plana", () => {
  const KEYS = [{ f: 0, x: 0, y: 0, scale: 1 }, { f: 4, x: 900, y: 500, scale: 1.4 }];
  it("apaga inclinación y desenfoque en un viaje rápido", () => {
    const normal = cameraAt(2, KEYS);
    expect(Math.abs(normal.rx) + Math.abs(normal.ry) + normal.blur).toBeGreaterThan(0);
    for (let f = 0; f <= 4; f++) {
      const c = cameraAt(f, KEYS, { profile: "plana" });
      expect(c.rx).toBe(0);
      expect(c.ry).toBe(0);
      expect(c.blur).toBe(0);
    }
  });
  it("lo explícito gana al perfil y el perfil gana al tema", () => {
    expect(cameraAt(2, KEYS, { profile: "plana", maxTilt: 8, tiltGain: 0.05 }).rx).not.toBe(0);
    const Probe = ({ f }: { f: number }) => {
      const c = useCameraAt(f, KEYS, { profile: "plana" });
      return <i data-c={`${c.rx}|${c.ry}|${c.blur}`} />;
    };
    const tilty: Theme = { ...neon, style: { ...neon.style, motion: { ...neon.style?.motion, cameraTilt: 3, cameraBlur: true } } };
    expect(ssr(<Probe f={2} />, 2, tilty)).toContain('data-c="0|0|0"');
  });
});

describe("proyección del mundo a la pantalla", () => {
  it("sin inclinación es la cuenta plana y coincide con el mundo", () => {
    const cam = { x: 500, y: 300, scale: 2 };
    expect(projectPoint({ x: 500, y: 300 }, cam, FORMAT)).toEqual({ x: 960, y: 540 });
    expect(projectRect({ x: 400, y: 250, w: 200, h: 100 }, cam, FORMAT)).toEqual({ x: 760, y: 440, w: 400, h: 200 });
    // con la cámara de cameraView: el rectángulo visible ocupa todo el cuadro
    const v = cameraView(cam, FORMAT);
    expect(projectRect(v, cam, FORMAT)).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });
  it("con inclinación contempla la perspectiva (el foco no se mueve; un borde más cercano se agranda)", () => {
    const cam = { x: 500, y: 300, scale: 1, rx: 0, ry: 20 };
    const c = projectPoint({ x: 500, y: 300 }, cam, FORMAT);
    expect(c.x).toBeCloseTo(960, 9);
    expect(c.y).toBeCloseTo(540, 9);
    // a 200 px a la derecha del foco con ry 20°: x1 = 200 cos 20 = 187,94; z = -200 sin 20 = -68,4; w = 1 + 68,4 / 2400
    const p = projectPoint({ x: 700, y: 300 }, cam, FORMAT);
    const w = 1 + (200 * Math.sin((20 * Math.PI) / 180)) / 2400;
    expect(p.x).toBeCloseTo(960 + (200 * Math.cos((20 * Math.PI) / 180)) / w, 9);
    // la caja envolvente de un rectángulo inclinado es más angosta que la plana
    const r = projectRect({ x: 300, y: 250, w: 400, h: 100 }, cam, FORMAT);
    expect(r.w).toBeLessThan(400);
    expect(r.w).toBeGreaterThan(300);
  });
  it("falla con un mensaje claro si algo queda detrás de la cámara", () => {
    expect(() => projectRect({ x: 0, y: 5000, w: 10, h: 10 }, { x: 0, y: 0, scale: 10, rx: 60, ry: 0 }, FORMAT)).toThrow(/detrás de la cámara.*plana/);
  });
});

describe("etiqueta con lado fijo", () => {
  const target: Rect = { x: 900, y: 500, w: 120, h: 60 };
  it("`decideBeside` devuelve lado y alineación; repetidos con `fixed` dan el mismo lugar", () => {
    const size = { w: 200, h: 50 };
    const d = decideBeside(target, size, { within: { x: 0, y: 0, w: 1920, h: 1080 } });
    expect(d.side).toBe("right");
    const again = placeBeside(target, size, { prefer: [d.side], align: d.align, within: { x: 0, y: 0, w: 1920, h: 1080 } });
    expect({ x: again.x, y: again.y }).toEqual({ x: d.x, y: d.y });
  });
  it("sin `fixed` el lado cambia cuando cambia el lugar libre; con `fixed` no", () => {
    const text = "Elegí la fecha";
    const safe: Rect = { x: 70, y: 55, w: 1780, h: 970 };
    // con la cámara asentada sobre el objetivo (centrado) hay lugar a la derecha
    const settled = cameraAt(200, guidedCameraKeys({ ...BASE, signals: [{ id: "x", target: { x: 1700, y: 500, w: 120, h: 60 }, start: 0, duration: 400 }] }), { profile: "plana" });
    const tgt: Rect = { x: 1700, y: 500, w: 120, h: 60 };
    const fin = projectRect(tgt, settled, FORMAT);
    const dec = calloutDecision(neutral, { target: fin, text, within: safe });
    expect(dec.side).toBe("right");
    // durante el viaje el objetivo está cerca del borde derecho: sin fijar, la etiqueta cambia de lado
    const lados = new Set<string>();
    const fijos = new Set<string>();
    const keys = guidedCameraKeys({ ...BASE, signals: [{ id: "x", target: tgt, start: 0, duration: 400 }] });
    for (let f = 0; f <= 40; f++) {
      const r = projectRect(tgt, cameraAt(f, keys, { profile: "plana" }), FORMAT);
      lados.add(calloutPlacement(neutral, { target: r, text, within: safe }).side);
      fijos.add(calloutPlacement(neutral, { target: r, text, within: safe, fixed: dec }).side);
    }
    expect(lados.size).toBeGreaterThan(1);
    expect([...fijos]).toEqual([dec.side]);
  });
});

const SIGNALS: StepSignal[] = [
  { id: "fecha", target: A, start: 20, duration: 70, label: "Elegí la fecha", card: { label: "Cupos", value: "12 lugares", side: "below" } },
  { id: "total", target: B, start: 100, duration: 40, label: "Revisá el total" },
];
const Marco = ({ f }: { f: number }) => (
  <StepFrame frame={f} overview={{ x: 960, y: 540 }} zoom={{ in: 1.8 }} signals={SIGNALS} step={{ index: 1, count: 4, duration: 150 }}>
    <div style={{ position: "absolute", left: 300, top: 400 }}>mundo</div>
  </StepFrame>
);

describe("marco de paso y marcas para qa", () => {
  it("marca el mundo, lo asentado, el objetivo activo y las capas fijas", () => {
    // viajando (cuadro 25): hay mundo y objetivo activo, pero no asentada
    const viaje = dom(ssr(<Marco f={25} />, 25));
    expect(viaje.querySelectorAll("[data-qa-world]").length).toBe(1);
    expect(viaje.querySelector("[data-qa-settled]")).toBeNull();
    expect(viaje.querySelector("[data-qa-target]")?.getAttribute("data-qa-target")).toBe("fecha");
    expect(viaje.querySelector("[data-qa-overlay]")).not.toBeNull();
    // asentada (cuadro 50)
    const quieta = dom(ssr(<Marco f={50} />, 50));
    expect(quieta.querySelector("[data-qa-world]")?.getAttribute("data-qa-settled")).toBe("true");
    expect(quieta.querySelectorAll("[data-qa-target]").length).toBe(1);
    // entre señales: el objetivo anterior ya no está marcado
    const entre = dom(ssr(<Marco f={95} />, 95));
    expect(entre.querySelector("[data-qa-target]")).toBeNull();
    // la segunda señal
    const dos = dom(ssr(<Marco f={125} />, 125));
    expect(dos.querySelector("[data-qa-target]")?.getAttribute("data-qa-target")).toBe("total");
    expect(dos.querySelector("[data-qa-world]")?.getAttribute("data-qa-settled")).toBe("true");
    // barra de progreso: una sola, arriba, sin fondo propio más que el acento
    const bar = [...dos.querySelectorAll("[data-qa-overlay]")].filter((e) => (e as HTMLElement).style.height === "4px" && (e as HTMLElement).style.top === "0px");
    expect(bar.length).toBe(1);
  });

  it("la etiqueta sigue al foco con el mismo lado y la misma posición relativa durante todo el viaje", () => {
    const rel: string[] = [];
    for (let f = 22; f <= 60; f++) {
      const d = dom(ssr(<Marco f={f} />, f));
      const pill = [...d.querySelectorAll('[data-ve-piece="Callout"]')].find((e) => e.tagName === "DIV") as HTMLElement | undefined;
      expect(pill, `cuadro ${f}`).toBeDefined();
      const x = parseFloat(pill!.style.left), y = parseFloat(pill!.style.top);
      expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
      const cam = cameraAt(f, guidedCameraKeys({ ...BASE, signals: SIGNALS }), { profile: "plana" });
      const r = projectRect(A, cam, FORMAT);
      rel.push(`${Math.sign(x - (r.x + r.w / 2))}|${Math.sign(y - (r.y + r.h / 2))}`);
    }
    // nunca cambia de lado respecto del foco (la etiqueta de abajo no pasa a estar arriba, la de la derecha no pasa a la izquierda)
    expect(new Set(rel).size).toBe(1);
  });

  it("la decisión sale de la cámara asentada: es la misma desde cualquier cuadro", () => {
    const opciones = { ...BASE, signals: SIGNALS };
    const plan = guidedCameraPlan(opciones);
    const fin = projectRect(A, plan.stops[0]!.key, FORMAT);
    expect({ x: fin.x + fin.w / 2, y: fin.y + fin.h / 2 }).toEqual({ x: 960, y: 540 });
    const d1 = dataCardDecision(neutral, { target: fin, label: "Cupos", value: "12 lugares", side: "below" });
    expect(d1.side).toBe("below");
  });

  it("es una función pura del cuadro (mismo cuadro, mismo marcado)", () => {
    expect(ssr(<Marco f={47} />, 47)).toBe(ssr(<Marco f={47} />, 47));
    const solo = ssr(<ProgressBar step={0} steps={2} progress={0.5} />, 0);
    expect(solo).toContain("width:480px");
    expect(stepProgress(1, 4, 0.5)).toBe(0.375);
    expect(ssr(<ProgressBar step={0} steps={3} />, 0)).toBe("");
  });

  it("World y Callout suman las marcas sin cambiar nada más", () => {
    const html = ssr(<World camera={{ x: 960, y: 540, scale: 1, rx: 0, ry: 0, blur: 0 }} width={1920} height={1080}><b /></World>, 0);
    expect(html).toContain('data-qa-world="true"');
    expect(html).not.toContain("data-qa-settled");
    expect(ssr(<Callout target={A} text="x" range={[0, 40]} />, 20)).not.toContain("data-qa-overlay");
    expect(ssr(<Callout target={A} text="x" range={[0, 40]} overlay />, 20)).toContain('data-qa-overlay="true"');
    expect(ssr(<DataCard target={A} label="a" value="b" range={[0, 40]} />, 20)).toContain("data-qa-overlay");
  });
});
