import { describe, expect, it } from "vitest";
import {
  aSrt, aVtt, aJson, cortesDeEscenas, formatearTiempo, leerSubtitulosJson, paginarSubtitulo, palabrasDe, parsearSrt, parsearSubtitulos, parsearTiempo,
  parsearVtt, partirEnFrases, partirPorCaracteres, subtituloActivo, subtitulosDeGuion,
} from "./subtitulos";
import type { Subtitulo } from "./subtitulos";

// medidor sintético: 10 px por carácter (el espacio también)
const medir = (t: string) => t.length * 10;

describe("tiempos", () => {
  it("lee y escribe SRT y VTT", () => {
    expect(parsearTiempo("00:00:01,500")).toBe(1.5);
    expect(parsearTiempo("01:02:03.004")).toBe(3723.004);
    expect(parsearTiempo("02:03.5")).toBe(123.5);
    expect(parsearTiempo("hola")).toBeNull();
    expect(formatearTiempo(3723.004)).toBe("01:02:03,004");
    expect(formatearTiempo(1.9996, ".")).toBe("00:00:02.000");
  });
});

describe("JSON", () => {
  it("acepta una lista en segundos o un objeto en cuadros", () => {
    expect(leerSubtitulosJson([{ desde: 1, hasta: 2, texto: "a\n b" }])).toEqual([{ desde: 1, hasta: 2, texto: "a b" }]);
    const c = leerSubtitulosJson({ unidad: "cuadros", fps: 30, cues: [{ desde: 30, hasta: 75, texto: "x" }, { desde: 0, hasta: 15, texto: "y" }] });
    expect(c.map((q) => [q.desde, q.hasta, q.texto])).toEqual([[0, 0.5, "y"], [1, 2.5, "x"]]);
    expect(leerSubtitulosJson({ unidad: "cuadros", cues: [{ desde: 30, hasta: 60, texto: "x" }] }, 30)[0]!.hasta).toBe(2);
  });
  it("rechaza datos inválidos con un mensaje claro", () => {
    expect(() => leerSubtitulosJson({ unidad: "cuadros", cues: [{ desde: 0, hasta: 1, texto: "x" }] })).toThrow(/fps/);
    expect(() => leerSubtitulosJson([{ desde: 2, hasta: 1, texto: "x" }])).toThrow(/mayor que/);
    expect(() => leerSubtitulosJson([{ desde: -1, hasta: 1, texto: "x" }])).toThrow(/negativo/);
    expect(() => leerSubtitulosJson("nada")).toThrow(/lista/);
    expect(() => leerSubtitulosJson({ unidad: "ms", cues: [] })).toThrow(/unidad/);
  });
  it("ida y vuelta con aJson", () => {
    const c: Subtitulo[] = [{ desde: 0.5, hasta: 2, texto: "uno", palabras: [{ desde: 0.5, hasta: 2, texto: "uno" }] }];
    expect(leerSubtitulosJson(JSON.parse(aJson(c)))).toEqual(c);
  });
});

describe("SRT", () => {
  const srt = "﻿1\r\n00:00:01,000 --> 00:00:03,500\r\n<i>Hola</i> &amp; chau\r\ncon dos líneas\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nOtro\r\n";
  it("lee CRLF, BOM, etiquetas, entidades y junta las líneas", () => {
    expect(parsearSrt(srt)).toEqual([
      { desde: 1, hasta: 3.5, texto: "Hola & chau con dos líneas" },
      { desde: 4, hasta: 5, texto: "Otro" },
    ]);
  });
  it("escribe y vuelve a leer lo mismo", () => {
    const cues = parsearSrt(srt);
    const txt = aSrt(cues);
    expect(txt.startsWith("1\n00:00:01,000 --> 00:00:03,500\n")).toBe(true);
    expect(parsearSrt(txt)).toEqual(cues);
  });
  it("parte los renglones del archivo sin cortar palabras", () => {
    const largo = "uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince";
    const r = partirPorCaracteres(largo, 30);
    expect(r.every((x) => x.length <= 30)).toBe(true);
    expect(r.join(" ")).toBe(largo);
    expect(r.length).toBe(Math.ceil(largo.length / 30));
  });
  it("un tiempo ilegible falla nombrando el subtítulo", () => {
    expect(() => parsearSrt("1\n00:00:xx,000 --> 00:00:03,000\nhola\n")).toThrow();
    expect(() => parsearSrt("1\nabc --> def\nhola\n")).toThrow(/Subtítulo 1/);
  });
});

describe("VTT", () => {
  const vtt = "WEBVTT\n\nNOTE esto no es un cue\n\nSTYLE\n::cue { color: red }\n\nintro\n00:01.000 --> 00:03.000 align:start position:10%\nHola <00:01.500>mundo <00:02.000>feliz\n\n00:04.000 --> 00:05.000\nOtro\n";
  it("lee cabecera, notas, identificadores, ajustes y tiempos por palabra", () => {
    const c = parsearVtt(vtt);
    expect(c).toHaveLength(2);
    expect(c[0]!.texto).toBe("Hola mundo feliz");
    expect(c[0]!.palabras!.map((p) => [p.texto, p.desde, p.hasta])).toEqual([["Hola", 1, 1.5], ["mundo", 1.5, 2], ["feliz", 2, 3]]);
    expect(c[1]).toEqual({ desde: 4, hasta: 5, texto: "Otro" });
    expect(parsearSubtitulos(vtt)).toEqual(c);
  });
  it("escribe con y sin etiquetas por palabra", () => {
    const c = parsearVtt(vtt);
    expect(aVtt(c)).toContain("00:00:01.000 --> 00:00:03.000\nHola mundo feliz");
    expect(aVtt(c, { conPalabras: true })).toContain("Hola <00:00:01.500>mundo <00:00:02.000>feliz");
    expect(parsearVtt(aVtt(c, { conPalabras: true }))[0]!.palabras).toEqual(c[0]!.palabras);
    expect(aVtt(c).startsWith("WEBVTT\n\n")).toBe(true);
  });
});

describe("palabras y guion", () => {
  it("reparte los tiempos por largo y cubre todo el subtítulo", () => {
    const p = palabrasDe({ desde: 1, hasta: 3, texto: "es una prueba larga" });
    expect(p.map((x) => x.texto)).toEqual(["es", "una", "prueba", "larga"]);
    expect(p[0]!.desde).toBe(1);
    expect(p[3]!.hasta).toBeCloseTo(3, 9);
    for (let i = 1; i < p.length; i++) expect(p[i]!.desde).toBeCloseTo(p[i - 1]!.hasta, 9);
  });
  it("parte en frases por puntuación y por largo", () => {
    expect(partirEnFrases("Una frase. Otra frase! ¿Y esta?")).toEqual(["Una frase.", "Otra frase!", "¿Y esta?"]);
    const largo = "uno dos tres cuatro, cinco seis siete ocho nueve, diez once doce trece catorce quince dieciséis";
    const r = partirEnFrases(largo, 40);
    expect(r.every((x) => x.length <= 40)).toBe(true);
    expect(r.join(" ")).toBe(largo);
  });
  it("subtitulosDeGuion reparte la escena por cantidad de palabras, escena tras escena", () => {
    const c = subtitulosDeGuion(
      [{ texto: "Una dos tres. Cuatro cinco seis siete ocho nueve.", frames: 150 }, { texto: "", frames: 60 }, { texto: ["Fin."], segundos: 3 }],
      { fps: 30, entradaSec: 0.5, salidaSec: 0.5 },
    );
    expect(c).toHaveLength(3);
    // escena 1: 0..5 s, útil 0.5..4.5; 3 y 6 palabras -> 4/3 s y 8/3 s
    expect(c[0]).toMatchObject({ desde: 0.5, hasta: 1.833, texto: "Una dos tres." });
    expect(c[1]!.hasta).toBe(4.5);
    // escena 3 arranca a los 5 + 2 s
    expect(c[2]!.desde).toBe(7.5);
    expect(c[2]!.hasta).toBe(9.5);
    expect(subtitulosDeGuion([{ texto: "a b", frames: 30 }], { fps: 30, conPalabras: true })[0]!.palabras).toHaveLength(2);
    expect(() => subtitulosDeGuion([{ texto: "x" }], { fps: 30 })).toThrow(/duración/);
  });
  it("cortes de escena", () => {
    expect(cortesDeEscenas([5, 2, 3])).toEqual([5, 7]);
    expect(cortesDeEscenas([4], 1)).toEqual([]);
  });
  it("subtituloActivo", () => {
    const c: Subtitulo[] = [{ desde: 0, hasta: 1, texto: "a" }, { desde: 1, hasta: 2, texto: "b" }];
    expect(subtituloActivo(c, 0.5)).toBe(0);
    expect(subtituloActivo(c, 1)).toBe(1);
    expect(subtituloActivo(c, 2)).toBeNull();
  });
});

describe("paginarSubtitulo", () => {
  const cue = (texto: string): Subtitulo => ({ desde: 0, hasta: 10, texto });
  it("un renglón si entra", () => {
    const p = paginarSubtitulo(cue("hola mundo"), medir, { ancho: 200, holgura: 1 });
    expect(p).toHaveLength(1);
    expect(p[0]!.renglones.map((r) => r.map((w) => w.texto).join(" "))).toEqual(["hola mundo"]);
  });
  it("dos renglones parejos, sin pasarse del ancho", () => {
    const p = paginarSubtitulo(cue("uno dos tres cuatro cinco seis"), medir, { ancho: 200, holgura: 1 });
    expect(p).toHaveLength(1);
    const r = p[0]!.renglones.map((x) => x.map((w) => w.texto).join(" "));
    expect(r).toEqual(["uno dos tres", "cuatro cinco seis"]);
    expect(r.every((x) => medir(x) <= 200)).toBe(true);
  });
  it("si no entra en dos renglones, pagina sin perder ni cortar palabras", () => {
    const texto = "primera parte del texto, y luego otra parte mucho más larga que no entra en dos renglones de este ancho ni de casualidad";
    const p = paginarSubtitulo(cue(texto), medir, { ancho: 200, holgura: 1 });
    expect(p.length).toBeGreaterThan(1);
    const todas = p.flatMap((x) => x.renglones.flat().map((w) => w.texto));
    expect(todas.join(" ")).toBe(texto);
    for (const pg of p) {
      expect(pg.renglones.length).toBeLessThanOrEqual(2);
      for (const r of pg.renglones) expect(medir(r.map((w) => w.texto).join(" "))).toBeLessThanOrEqual(200);
    }
    expect(JSON.stringify(p)).not.toContain("…");
    // tiempos contiguos, de 0 a 10
    expect(p[0]!.desde).toBe(0);
    expect(p[p.length - 1]!.hasta).toBe(10);
    for (let i = 1; i < p.length; i++) expect(p[i]!.desde).toBeCloseTo(p[i - 1]!.hasta, 9);
  });
  it("reparte las páginas parejo en vez de llenar la primera y dejar un resto corto", () => {
    const ws = Array.from({ length: 12 }, () => "aaaa");
    const p = paginarSubtitulo(cue(ws.join(" ")), medir, { ancho: 340, holgura: 1, maxRenglones: 1 }); // en un renglón entran 7
    expect(p.map((x) => x.renglones[0]!.length)).toEqual([6, 6]);
    const q = paginarSubtitulo(cue("uno dos tres, cuatro cinco seis. siete ocho nueve diez once doce trece"), medir, { ancho: 150, holgura: 1, maxRenglones: 1 });
    expect(q.every((x) => x.renglones.length === 1)).toBe(true);
    expect(q.flatMap((x) => x.renglones[0]!.map((w) => w.texto)).join(" ")).toBe("uno dos tres, cuatro cinco seis. siete ocho nueve diez once doce trece");
  });
  it("una palabra más ancha que el renglón queda sola, entera", () => {
    const p = paginarSubtitulo(cue("a superlongitudinalmente b"), medir, { ancho: 100, holgura: 1 });
    expect(p.flatMap((x) => x.renglones.flat().map((w) => w.texto)).join(" ")).toBe("a superlongitudinalmente b");
  });
  it("usa los tiempos de las palabras para cortar las páginas", () => {
    const c: Subtitulo = {
      desde: 0, hasta: 6, texto: "x",
      palabras: ["aaaa", "bbbb", "cccc", "dddd", "eeee", "ffff"].map((t, i) => ({ desde: i, hasta: i + 1, texto: t })),
    };
    const p = paginarSubtitulo(c, medir, { ancho: 90, holgura: 1, maxRenglones: 1 });
    expect(p.map((x) => x.renglones[0]!.length)).toEqual([2, 2, 2]);
    expect(p.map((x) => [x.desde, x.hasta])).toEqual([[0, 2], [2, 4], [4, 6]]);
  });
});
