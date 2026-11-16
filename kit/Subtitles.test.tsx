import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, dark, editorial, neon, neutral, papel } from "../themes";
import type { Theme } from "../themes";
import { Subtitles, subtitleBand } from "./index";
import type { Subtitulo } from "./index";

const cfg = (w: number, h: number) => ({ fps: 30, width: w, height: h, durationInFrames: 300 });
const SIZES = { horizontal: cfg(1920, 1080), vertical: cfg(1080, 1920), cuadrado: cfg(1080, 1080) };
const html = (node: React.ReactNode, theme: Theme, frame: number, c = SIZES.horizontal) =>
  renderToString(<FrameProvider frame={frame} config={c}><ThemeProvider theme={theme}>{node}</ThemeProvider></FrameProvider>);

const CUES: Subtitulo[] = [
  { desde: 1, hasta: 3, texto: "Un subtítulo corto." },
  { desde: 3, hasta: 6, texto: "Otro que sigue pegado al anterior sin pausa de por medio y que es largo." },
  { desde: 7, hasta: 9, texto: "Cada palabra al ritmo", palabras: [{ desde: 7, hasta: 7.5, texto: "Cada" }, { desde: 7.5, hasta: 8, texto: "palabra" }, { desde: 8, hasta: 8.5, texto: "al" }, { desde: 8.5, hasta: 9, texto: "ritmo" }] },
];
const TEMAS = [neutral, dark, editorial, neon, papel];

describe("Subtitles", () => {
  it("no dibuja nada fuera de un subtítulo y dibuja el texto dentro", () => {
    expect(html(<Subtitles cues={CUES} />, neutral, 10)).toBe("");
    expect(html(<Subtitles cues={CUES} />, neutral, 60)).toContain("Un subtítulo corto.");
    expect(html(<Subtitles cues={CUES} />, neutral, 200)).toBe("");
  });
  it("todo sale del tema: la fuente no lleva #hex y el texto se ve con cada design system", () => {
    const fuente = readFileSync(join(process.cwd(), "kit/Subtitles.tsx"), "utf8") + readFileSync(join(process.cwd(), "kit/subtitulos.ts"), "utf8");
    expect(fuente).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const t of TEMAS) expect(html(<Subtitles cues={CUES} estilo="karaoke" />, t, 60), t.name).toContain(`font-family:${t.font.family.split(",")[0]}`);
  });
  it("en los tres formatos queda dentro del cuadro y en vertical deja libre la franja de abajo", () => {
    for (const t of TEMAS) {
      const h = subtitleBand(t, { width: 1920, height: 1080 });
      const v = subtitleBand(t, { width: 1080, height: 1920 });
      const c = subtitleBand(t, { width: 1080, height: 1080 });
      expect(h.y + h.h).toBeLessThanOrEqual(1080 - t.safe.y);
      expect(c.y + c.h).toBeLessThanOrEqual(1080 - t.safe.y);
      expect(v.y + v.h).toBeLessThanOrEqual(1920 * 0.75);
      for (const r of [h, v, c]) expect(r.x).toBeGreaterThanOrEqual(t.safe.x);
    }
    const out = html(<Subtitles cues={CUES} />, neutral, 60, SIZES.vertical);
    expect(out).toMatch(/bottom:499px|bottom:499\.2px/);
  });
  it("karaoke colorea por palabra y bloque no", () => {
    const k = html(<Subtitles cues={CUES} estilo="karaoke" />, neutral, 7 * 30 + 20); // hacia el 7,67 s: "Cada" dicha, "palabra" en curso
    expect((k.match(/<span/g) ?? []).length).toBe(4);
    const b = html(<Subtitles cues={CUES} />, neutral, 7 * 30 + 20);
    expect(b).not.toContain("<span");
    expect(b).toContain("Cada palabra al ritmo");
  });
  it("nunca corta con puntos suspensivos y reparte todo el texto, incluso con texto larguísimo", () => {
    const largo = "palabra ".repeat(60).trim();
    const cues: Subtitulo[] = [{ desde: 0, hasta: 12, texto: largo }];
    let juntas = "";
    for (let f = 0; f < 360; f += 3) {
      const out = html(<Subtitles cues={cues} />, neutral, f);
      expect(out).not.toContain("…");
      expect(out).not.toContain("ellipsis");
    }
    for (let f = 0; f < 360; f++) {
      const m = />([^<>]*palabra[^<>]*)</.exec(html(<Subtitles cues={cues} />, neutral, f));
      if (m) juntas += (juntas ? " " : "") + m[1];
    }
    expect(new Set(juntas.split(/\s+/)).has("palabra")).toBe(true);
  });
  it("es una función pura del cuadro", () => {
    const seq = [60, 10, 85, 200, 60];
    const a = seq.map((f) => html(<Subtitles cues={CUES} estilo="karaoke" />, editorial, f));
    expect(a[0]).toBe(a[4]);
  });
  it("entra animando solo si hay pausa antes; pegado al anterior cambia de golpe", () => {
    const a = html(<Subtitles cues={CUES} />, neutral, 30); // primer cuadro del primer subtítulo, hay pausa antes
    expect(a).toMatch(/opacity/);
    const b = html(<Subtitles cues={CUES} />, neutral, 90); // primer cuadro del segundo, pegado al primero
    expect(b).not.toMatch(/opacity|transform/);
    // sale con un fundido si sigue una pausa, no si sigue otro subtítulo
    expect(html(<Subtitles cues={CUES} />, neutral, 89)).not.toMatch(/opacity/);
    expect(html(<Subtitles cues={CUES} />, neutral, 179)).toMatch(/opacity/);
  });
  it("offsetSec corre los tiempos", () => {
    expect(html(<Subtitles cues={CUES} offsetSec={2} />, neutral, 70)).toBe("");
    expect(html(<Subtitles cues={CUES} offsetSec={2} />, neutral, 100)).toContain("Un subtítulo corto.");
  });
});
