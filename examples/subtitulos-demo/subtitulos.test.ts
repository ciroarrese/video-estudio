import { describe, expect, it } from "vitest";
import { cortesDeEscenas, leerSubtitulosJson } from "../../kit";
import { verificarVozEscenas } from "../../audio/voz";
import pista from "./subtitulos.json";

describe("subtitulos-demo: los subtítulos no pisan los cortes de escena", () => {
  it("sin avisos contra las escenas del video (100, 110 y 90 cuadros a 30 fps)", () => {
    const cues = leerSubtitulosJson(pista);
    const cortes = cortesDeEscenas([100 / 30, 110 / 30, 90 / 30]);
    const avisos = verificarVozEscenas(cues, cortes, { duracionSec: 10 });
    expect(avisos.map((a) => a.mensaje)).toEqual([]);
  });
  it("las palabras del karaoke cubren el subtítulo que las trae", () => {
    const c = leerSubtitulosJson(pista).find((q) => q.palabras)!;
    expect(c.palabras![0]!.desde).toBe(c.desde);
    expect(c.palabras![c.palabras!.length - 1]!.hasta).toBeCloseTo(c.hasta, 6);
    expect(c.palabras!.map((p) => p.texto).join(" ")).toBe(c.texto);
  });
});
