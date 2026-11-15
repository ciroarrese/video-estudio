import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, editorial, neutral } from "../themes";
import type { Theme } from "../themes";
import { Closing, Interlude, InterludeCompact, Opening, TopicHeadline, TopicProvider, closingFrames, interludeFrames, interludeRevealFrames, openingFrames } from "./index";
import type { StorySpec } from "./index";
import { fitRowsUniform, lineMeter, listLayout, nameMeter, pillFit, wrapMeasured } from "./layout";

/**
 * Formatos angostos (vertical y cuadrado): el nombre de un tema nunca se corta con "…" y la bajada solo como último recurso.
 * La lista acomoda el texto midiéndolo (`fitRowsUniform`): todo el ancho, después hasta dos renglones y recién al final letra más chica.
 * El formato horizontal no cambia: lo cubren `stories.test.tsx` y las pruebas de reposo.
 */

const NOMBRES = [
  "Módulo Sincro Presta",
  "Asistente de respuestas para el equipo de soporte",
  "Tablero de monitoreo de sincronizaciones",
  "Health Score",
  "Video Studio",
  "Conciliación de pedidos y existencias con ERP", // 45 caracteres
];
const LARGUISIMO = "Módulo de conciliación de pedidos y existencias entre tienda y ERP"; // 66 caracteres
const LINEAS = [
  "videos a partir de contexto y un design system",
  "responde, dicta y escala sin salir del ticket",
  "avisa antes de que el cliente reclame",
  "a quién contactar primero",
  "una bajada algo más larga que las demás, para ver cómo se parte en dos renglones",
  "la tienda y el ERP, siempre sincronizados",
];
const specN = (n: number): StorySpec => ({
  title: { text: "Proyectos con IA", highlight: "IA" },
  topics: Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: NOMBRES[i]!, line: LINEAS[i]! })),
  labels: ["Uno", "Dos", "Tres"],
  signoff: { text: "Gracias" },
});

const FORMATS: [string, number, number][] = [["vertical", 1080, 1920], ["cuadrado", 1080, 1080], ["4:5", 1080, 1350]];
const theme = (t: Theme = neutral) => t;

describe("fitRowsUniform", () => {
  const th = theme();
  const m = nameMeter(th);
  const o = { width: 700, size: 80, min: 48, hardMin: 30, maxRows: 2, meter: m };
  it("usa todo el ancho antes de partir, y parte antes de achicar", () => {
    const corto = fitRowsUniform(["Health Score"], o);
    expect(corto).toEqual({ size: 80, rows: [["Health Score"]] });
    const largo = fitRowsUniform(["Módulo Sincro Presta"], o);
    expect(largo.size).toBe(80); // dos renglones con la letra entera: no se achicó
    expect(largo.rows[0]!.length).toBe(2);
    const enorme = fitRowsUniform(["Módulo de conciliación de pedidos y existencias entre tienda y ERP"], o);
    expect(enorme.size).toBeLessThan(80); // ya no entra en dos renglones: recién ahí se achica
    expect(enorme.size).toBeGreaterThanOrEqual(48);
  });
  it("un nombre nunca se corta con elipsis: pasa del piso con un renglón más y baja hasta el mínimo", () => {
    const r = fitRowsUniform(["palabra ".repeat(40).trim()], o);
    expect(r.rows.flat().join(" ")).not.toContain("…");
    expect(r.rows[0]!.join(" ")).toBe("palabra ".repeat(40).trim());
    expect(r.size).toBeLessThan(48);
    expect(r.size).toBeGreaterThanOrEqual(30);
  });
  it("la bajada solo se corta con elipsis tras dos renglones y con la letra al mínimo", () => {
    const lm = lineMeter(th);
    const ok = fitRowsUniform(["una bajada que entra en dos renglones sin problema alguno"], { width: 500, size: 36, min: 26, maxRows: 2, meter: lm, ellipsis: true });
    expect(ok.rows[0]!.join(" ")).not.toContain("…");
    const larga = "x".repeat(10) + " " + "palabra ".repeat(60);
    const cut = fitRowsUniform([larga], { width: 500, size: 36, min: 26, maxRows: 2, meter: lm, ellipsis: true });
    expect(cut.size).toBe(26);
    expect(cut.rows[0]!.length).toBe(2);
    expect(cut.rows[0]![1]!.endsWith("…")).toBe(true);
    expect(lm(cut.rows[0]![1]!, 26)).toBeLessThanOrEqual(500);
  });
  it("un solo tamaño para todos: el del que más necesita", () => {
    const r = fitRowsUniform(["Corto", "Módulo de conciliación de pedidos y existencias entre tienda y ERP"], o);
    const solo = fitRowsUniform(["Módulo de conciliación de pedidos y existencias entre tienda y ERP"], o);
    expect(r.size).toBe(solo.size);
    expect(r.rows[0]).toEqual(["Corto"]);
  });
  it("wrapMeasured respeta el ancho", () => {
    for (const row of wrapMeasured("uno dos tres cuatro cinco seis siete ocho nueve diez", 300, 40, m)) expect(m(row, 40)).toBeLessThanOrEqual(300);
  });
});

describe("listLayout en formatos angostos con nombres largos", () => {
  for (const [name, w, h] of FORMATS) {
    for (const n of [3, 4, 5, 6]) {
      it(`${name}, ${n} temas: ningún "…" en nombres ni en bajadas, todo entra en el cuadro y en su fila`, () => {
        const spec = specN(n);
        const L = listLayout(spec, neutral, w, h);
        expect(L.nameRows).toBeDefined();
        const nm = nameMeter(neutral), lm = lineMeter(neutral);
        const avail = L.stacked ? L.rowW : w - 2 * neutral.safe.x - L.numW; // el ancho que se le dio al texto (el medidor ya trae su holgura)
        for (let i = 0; i < n; i++) {
          expect(L.nameRows![i]!.join(" ")).toBe(spec.topics[i]!.name); // el nombre entero, partido a lo sumo en renglones
          expect(L.nameRows![i]!.length).toBeLessThanOrEqual(3);
          for (const r of L.nameRows![i]!) expect(nm(r, L.nameSize)).toBeLessThanOrEqual(avail + 1);
          for (const r of L.lineRows[i]!) expect(lm(r, L.lineSize)).toBeLessThanOrEqual(avail + 1);
          expect(L.lineRows[i]!.join(" ")).toBe(spec.topics[i]!.line);
          expect(L.lineRows[i]!.length).toBeLessThanOrEqual(2);
        }
        // la lista entra en el cuadro y cada bloque en su fila; el subrayado queda dentro de la fila
        expect(L.top).toBeGreaterThanOrEqual(0);
        expect(L.top + n * L.rowH).toBeLessThanOrEqual(h);
        // con 6 temas de nombres largos en un cuadro bajo la lista pasa el área segura antes que cortar un nombre; el bloque no pasa de su fila por más que el aire (22 px) que se le deja entre filas
        const slack = n === 6 && h <= 1350 ? 22 : 0;
        expect(L.blockTop).toBeGreaterThanOrEqual(-slack);
        expect(L.blockTop + L.blockH).toBeLessThanOrEqual(L.rowH + slack);
        expect(L.barTop + 8).toBeLessThanOrEqual(L.blockTop + L.blockH + 1);
        expect(L.left).toBeGreaterThanOrEqual(0);
        expect(L.left + L.rowW).toBeLessThanOrEqual(w);
        expect(L.nameSize).toBeGreaterThanOrEqual(28);
      });
    }
  }
  it("una bajada de más de dos renglones es lo único que puede cortarse, y solo ella", () => {
    for (const [, w, h] of FORMATS) {
      const spec = specN(3);
      const larga = "una bajada interminable ".repeat(12).trim();
      spec.topics[1] = { ...spec.topics[1]!, line: larga };
      const L = listLayout(spec, neutral, w, h);
      expect(L.lineRows[1]!.length).toBe(2);
      expect(L.lineRows[1]![1]!.endsWith("…")).toBe(true);
      expect(L.lineRows[0]!.join(" ")).not.toContain("…");
      expect(L.names.some((nm) => nm.includes("…"))).toBe(false);
      expect(L.blockTop + L.blockH).toBeLessThanOrEqual(L.rowH);
    }
  });
  it("un nombre de 66 caracteres tampoco se corta, en los tres formatos", () => {
    for (const [, w, h] of FORMATS) {
      const spec = specN(3);
      spec.topics[0] = { ...spec.topics[0]!, name: LARGUISIMO };
      const L = listLayout(spec, neutral, w, h);
      expect(L.nameRows![0]!.join(" ")).toBe(LARGUISIMO);
      expect(L.names[0]).not.toContain("…");
      expect(L.blockTop + L.blockH).toBeLessThanOrEqual(L.rowH);
      expect(L.top + 3 * L.rowH).toBeLessThanOrEqual(h);
    }
  });
  it("el caso real: en cuadrado 'Módulo Sincro Presta' y su bajada salen enteros", () => {
    const L = listLayout(specN(4), neutral, 1080, 1080);
    expect(L.names[0]).toBe("Módulo Sincro Presta");
    expect(L.lines[0]).toBe("videos a partir de contexto y un design system");
  });
  it("el formato horizontal sigue sin renglones propios (marcado de siempre) mientras nada se corte", () => {
    const corto = { ...specN(3), topics: [{ id: "a", name: "Panel de ventas", line: "los números del día" }, { id: "b", name: "Inventario", line: "stock y reposición" }, { id: "c", name: "Atención", line: "tickets y respuestas" }] };
    const L = listLayout(corto, neutral, 1920, 1080);
    expect(L.nameRows).toBeUndefined();
    expect(L.textW).toBeUndefined();
  });
  it("en horizontal, si la lista de siempre cortaría un nombre con \"…\", se acomoda en renglones (en ambas variantes de lista)", () => {
    for (const list of [undefined, "inline" as const]) {
      const spec: StorySpec = { ...specN(5), topics: specN(5).topics.map((t, i) => (i === 1 ? { ...t, name: LARGUISIMO } : t)), design: list ? { list } : undefined };
      const L = listLayout(spec, neutral, 1920, 1080);
      expect(L.nameRows![1]!.join(" ")).toBe(LARGUISIMO);
      expect(L.names.some((nm) => nm.includes("…"))).toBe(false);
      expect(L.lines.some((ln) => ln.includes("…"))).toBe(false);
      expect(L.blockTop + L.blockH).toBeLessThanOrEqual(L.rowH);
    }
  });
});

const cfg = (w: number, h: number) => ({ fps: 30, width: w, height: h, durationInFrames: 1000 });
const html = (node: React.ReactNode, th: Theme, frame: number, w: number, h: number) =>
  renderToString(<FrameProvider frame={frame} config={cfg(w, h)}><ThemeProvider theme={th}>{node}</ThemeProvider></FrameProvider>);

describe("las piezas dibujan el nombre entero en formatos angostos", () => {
  for (const [name, w, h] of FORMATS) {
    for (const th of [neutral, editorial]) {
      it(`${name}/${th.name}: apertura, vueltas, revelación y cierre sin "…" en los nombres`, () => {
        const spec = specN(5);
        const late: StorySpec = { ...spec, topics: spec.topics.map((t, i) => (i === 4 ? { ...t, reveal: "late" as const } : t)) };
        const frames: string[] = [];
        const o = openingFrames(spec);
        for (const f of [o - 5, o - 1]) frames.push(html(<Opening spec={spec} first={0} />, th, f, w, h));
        for (const f of [30, 100]) frames.push(html(<Interlude spec={spec} done={2} />, th, Math.min(f, interludeFrames(spec) - 1), w, h));
        for (const f of [20, 60, 100, 130]) frames.push(html(<Interlude spec={late} done={5} />, th, Math.min(f, interludeRevealFrames(late) - 1), w, h));
        for (const f of [60, 150, 215, 235, 260, 330, closingFrames(spec) - 1]) frames.push(html(<Closing spec={spec} />, th, f, w, h)); // las píldoras: en el panel, en vuelo y en el muro
        for (const f of [10, 25]) frames.push(html(<InterludeCompact spec={{ ...spec, topics: spec.topics.map((t, i) => (i === 1 ? { ...t, name: LARGUISIMO } : t)) }} done={1} />, th, f, w, h)); // el que sigue es el de 66 caracteres
        for (const markup of frames) {
          // ningún "…" en ningún texto de ninguna pieza
          const texts = [...markup.matchAll(/>([^<>]*)</g)].map((m) => m[1]!).filter(Boolean);
          expect(texts.filter((t) => t.includes("…"))).toEqual([]);
        }
        const lista = html(<Interlude spec={spec} done={1} />, th, 100, w, h);
        for (const nombre of spec.topics.map((t) => t.name)) for (const palabra of nombre.split(" ")) expect(lista).toContain(palabra);
      });
    }
  }
});

describe("píldoras del cierre y titular de la escena", () => {
  it("la píldora parte el nombre en renglones antes que cortarlo, y no cambia si entra", () => {
    const corto = pillFit(neutral, "Health Score", 418);
    expect(corto.rows).toEqual(["Health Score"]);
    expect(corto.h).toBe(Math.round(corto.size * 1.25 + 2 * corto.size * 0.42 + 6));
    for (const nombre of [NOMBRES[1]!, NOMBRES[5]!, LARGUISIMO]) {
      for (const maxW of [336, 418, 546, 900]) {
        const p = pillFit(neutral, nombre, maxW);
        expect(p.rows.join(" ")).toBe(nombre);
        expect(p.rows.length).toBeLessThanOrEqual(3);
        expect(p.rows.some((r) => r.includes("…"))).toBe(false);
        expect(p.w).toBeLessThanOrEqual(Math.max(maxW, 0) + 2);
      }
    }
  });
  for (const [name, w, h] of FORMATS) {
    it(`${name}: el titular de la escena con un nombre de 66 caracteres sale entero`, () => {
      const th = neutral;
      const spec = specN(3);
      const markup = html(
        <TopicProvider spec={spec} index={0}><TopicHeadline start={0} /></TopicProvider>,
        th, 40, w, h,
      );
      expect(markup).not.toContain("…");
      const largo = html(<TopicHeadline title={LARGUISIMO} number={2} />, th, 40, w, h);
      expect(largo).not.toContain("…");
      expect(largo).toContain(LARGUISIMO);
    });
  }
});
