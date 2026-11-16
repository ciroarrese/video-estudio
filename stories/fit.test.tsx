import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameProvider } from "../engine";
import { ThemeProvider, neutral } from "../themes";
import { Closing, Interlude, Opening, checkStoryFit, defineStory, formatFitReport, interludeRevealFrames, openingFrames } from "./index";
import type { StorySpec } from "./index";
import { fitTitleNarrow, listLayout, listTextRects, panelLayout, revealThumbRect, TITLE_FLOOR } from "./layout";

/**
 * Largos del guion por formato (`checkStoryFit`), título de la apertura sin "…" y miniatura de la revelación / paneles del cierre en formatos angostos.
 * La medida en Node es la estimación por glifo de `kit/textWidth` (en el navegador, la real): las cifras de estas pruebas son de esa estimación.
 */

const palabras = "Conciliación de pedidos y existencias entre la tienda y el sistema contable del área";
const nombre = (n: number) => Array.from(palabras.repeat(3)).slice(0, n).join("").trim();
const spec = (n: number, nl: number, ll = 30, title = "Un día en la oficina"): StorySpec => ({
  title: { text: title, highlight: "oficina" },
  topics: Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: nombre(nl), line: "una bajada para el tema".slice(0, ll) })),
  labels: [],
  signoff: { text: "Gracias" },
});
const SIZES = { vertical: [1080, 1920], cuadrado: [1080, 1080] } as const;

describe("checkStoryFit", () => {
  it("una historia de largos normales entra en los tres formatos", () => {
    for (const f of ["horizontal", "vertical", "cuadrado"] as const) {
      const r = checkStoryFit(spec(4, 22), neutral, f);
      expect(r.ok, `${f}: ${r.causes.join("; ")}`).toBe(true);
      expect(formatFitReport(r)).toEqual([]);
    }
  });

  it("seis nombres muy largos en cuadrado no entran: dice qué acortar y a cuántos caracteres, y con eso entra", () => {
    const s = spec(6, 66);
    const r = checkStoryFit(s, neutral, "cuadrado");
    expect(r.ok).toBe(false);
    expect(r.suggest?.name).toBeGreaterThan(20);
    expect(r.suggest!.name!).toBeLessThan(66);
    expect(r.issues).toHaveLength(6);
    expect(r.issues[0]!.message).toMatch(/acortá el nombre del tema "t1" de 66 a unos \d+ caracteres/);
    // aplicando la sugerencia (a todos los nombres) la lista entra
    const corto = { ...s, topics: s.topics.map((t) => ({ ...t, name: t.name.slice(0, r.suggest!.name!).trimEnd() })) };
    expect(checkStoryFit(corto, neutral, "cuadrado").ok).toBe(true);
  });

  it("las bajadas largas se acortan cuando acortar el nombre no alcanza", () => {
    const s: StorySpec = { ...spec(6, 40), topics: spec(6, 40).topics.map((t) => ({ ...t, line: "una bajada larguísima que cuenta demasiadas cosas a la vez ".repeat(3).trim() })) };
    const r = checkStoryFit(s, neutral, "cuadrado");
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.kind === "line" || i.kind === "name")).toBe(true);
    expect(r.issues.every((i) => i.message.startsWith("Formato cuadrado:"))).toBe(true);
  });

  it("mide la lista de la apertura (sin el tema tardío) y la de la revelación (con todos)", () => {
    const s: StorySpec = { ...spec(4, 22), topics: spec(4, 22).topics.map((t, i) => (i === 3 ? { ...t, name: nombre(66), reveal: "late" as const } : t)) };
    const r = checkStoryFit(s, neutral, "cuadrado");
    expect(r.issues.map((i) => i.topic)).toContain(3);
  });

  it("el título largo avisa y propone un largo; uno normal entra en tres renglones sin bajar del piso", () => {
    const largo = "Un recorrido completo por todas las herramientas del área de administración y finanzas de la empresa, de punta a punta";
    const r = checkStoryFit(spec(3, 20, 30, largo), neutral, "cuadrado");
    expect(r.title.ok).toBe(false);
    const i = r.issues.find((x) => x.kind === "title")!;
    expect(i.maxChars).toBeLessThan(largo.length);
    expect(i.message).toContain("acortá el título");
    expect(checkStoryFit(spec(3, 20), neutral, "vertical").title.ok).toBe(true);
  });

  it("acepta un tamaño en vez de un formato", () => {
    expect(checkStoryFit(spec(3, 20), neutral, { width: 1080, height: 1350 }).ok).toBe(true);
  });

  it("defineStory deja la verificación registrada (la usa `qa`) y la puede apagar", () => {
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (m: string) => { warns.push(String(m)); };
    try {
      defineStory({ id: "fit-prueba", spec: spec(6, 66), scenes: [], formats: ["cuadrado"] });
      defineStory({ id: "fit-prueba-callada", spec: spec(6, 66), scenes: [], formats: ["cuadrado"], fitCheck: false });
    } finally { console.warn = orig; }
    expect(warns.some((w) => w.startsWith("aviso (fit-prueba): Formato cuadrado: acortá el nombre"))).toBe(true);
    expect(warns.some((w) => w.includes("fit-prueba-callada"))).toBe(false);
    const probe = (globalThis as any).__veStoryFit["fit-prueba"];
    expect(probe("cuadrado").ok).toBe(false);
    expect(probe("horizontal").ok).toBe(true);
    expect(probe("vertical")).toBeNull(); // el video no habilita ese formato
  });
});

describe("título de la apertura en formatos angostos", () => {
  it("nunca se corta con elipsis: renglones primero, letra más chica después", () => {
    const corto = fitTitleNarrow(neutral, "Proyectos con IA", 1080);
    // con la holgura de los formatos angostos (cada palabra entra aunque la letra sea más ancha o más grande) la letra puede bajar un poco del héroe, no más
    expect(corto.size).toBeLessThanOrEqual(neutral.type.hero);
    expect(corto.size).toBeGreaterThanOrEqual(neutral.type.hero * 0.9);
    expect(corto.rows.length).toBeLessThanOrEqual(3);
    const medio = fitTitleNarrow(neutral, "Un recorrido por las herramientas de administración y finanzas", 1080);
    expect(medio.rows.length).toBeLessThanOrEqual(3);
    expect(medio.ok).toBe(true);
    const enorme = fitTitleNarrow(neutral, "palabra ".repeat(40).trim(), 1080);
    expect(enorme.ok).toBe(false);
    expect(enorme.text).not.toContain("…");
    const r = fitTitleNarrow(neutral, "Un recorrido por las herramientas de administración y finanzas de toda la empresa en un solo video", 1080);
    if (r.ok) expect(r.size).toBeGreaterThanOrEqual(Math.round(neutral.type.hero * TITLE_FLOOR));
  });

  it("la apertura dibuja el título entero (sin elipsis) en vertical y cuadrado, con un título de 100 caracteres", () => {
    const titulo = "Un recorrido por todas las herramientas del área de administración y finanzas de la empresa";
    const s = spec(3, 20, 30, titulo);
    for (const [w, h] of Object.values(SIZES)) {
      const html = renderToString(<FrameProvider frame={10} config={{ fps: 30, width: w, height: h, durationInFrames: 1000 }}><ThemeProvider theme={neutral}><Opening spec={s} first={0} /></ThemeProvider></FrameProvider>);
      expect(html).not.toContain("…");
      expect(html).toContain("finanzas");
      expect(openingFrames(s)).toBeGreaterThan(10);
    }
  });
});

describe("miniatura de la revelación en formatos angostos", () => {
  const rev = (n: number): StorySpec => ({ ...spec(n, 18, 30), topics: spec(n, 18, 30).topics.map((t, i) => (i === n - 1 ? { ...t, name: "Un dato extra", line: "algo que no estaba en la lista", reveal: "late" as const } : { ...t, name: ["Panel de ventas", "Inventario", "Atención", "Reportes", "Compras"][i]!, line: ["los números del día en una sola vista", "qué hay, qué falta y qué se mueve", "cada consulta, con su respuesta a tiempo", "lo que se mandó y cuándo", "proveedores y pedidos"][i]! })) });
  for (const [name, [w, h]] of Object.entries(SIZES)) {
    for (const n of [3, 4, 5]) {
      it(`${name}, ${n} temas: mide al menos el 30 % del ancho, queda dentro del cuadro y no pisa texto`, () => {
        const s = rev(n);
        const L = listLayout(s, neutral, w, h);
        const t = revealThumbRect(L, neutral, n - 1, w, h);
        expect(t.w).toBeGreaterThanOrEqual(Math.round(w * 0.3));
        expect(t.x - t.w / 2).toBeGreaterThanOrEqual(0);
        expect(t.x + t.w / 2).toBeLessThanOrEqual(w);
        expect(t.y - t.h / 2).toBeGreaterThanOrEqual(0);
        expect(t.y + t.h / 2).toBeLessThanOrEqual(h);
        if (t.mode === "free") {
          const box = { x: t.x - t.w / 2, y: t.y - t.h / 2, w: t.w, h: t.h };
          for (const r of listTextRects(L, neutral, n - 1, L.rowH * 0.14)) {
            const hit = box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y;
            expect(hit, `pisa un texto en (${Math.round(r.x)}, ${Math.round(r.y)})`).toBe(false);
          }
        }
      });
    }
  }
  it("el vertical tiene lugar libre al costado; el cuadrado con la lista llena usa el centro", () => {
    expect(revealThumbRect(listLayout(rev(4), neutral, 1080, 1920), neutral, 3, 1080, 1920).mode).toBe("free");
  });
  it("la revelación se dibuja en ambos formatos con la miniatura grande (stage)", () => {
    const s: StorySpec = { ...rev(4), design: { reveal: "stage" }, timing: { interludeReveal: 200 } };
    for (const [w, h] of Object.values(SIZES)) {
      const html = renderToString(<FrameProvider frame={Math.round(interludeRevealFrames(s) * 0.4)} config={{ fps: 30, width: w, height: h, durationInFrames: 1000 }}><ThemeProvider theme={neutral}><Interlude spec={s} done={4} thumbnail={() => <div>mini</div>} /></ThemeProvider></FrameProvider>);
      const m = /width:560px;height:340px;transform:translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(html);
      expect(m, "no se encontró la miniatura").not.toBeNull();
      expect(560 * Number(m![3])).toBeGreaterThanOrEqual(w * 0.28); // en la entrada todavía no llegó a su tamaño final
    }
  });
});

describe("paneles del cierre en formatos angostos", () => {
  it("son lo más grandes que permite el cuadro: más que antes y dentro del ancho", () => {
    // antes (dos columnas con 80 px de margen y escala máxima 1,4): vertical 2 y 3 temas 1,4; 4 temas 0,79; cuadrado 2 a 4 temas 0,79
    const k = (n: number, w: number, h: number) => panelLayout(n, w, h)[0]!.k;
    expect(k(2, 1080, 1920)).toBeGreaterThan(1.4);
    expect(k(3, 1080, 1920)).toBeGreaterThan(1.4);
    expect(k(4, 1080, 1920)).toBeGreaterThan(0.9);
    expect(k(4, 1080, 1080)).toBeGreaterThan(0.8);
    for (const [w, h] of Object.values(SIZES)) for (const n of [2, 3, 4, 5, 6]) {
      for (const p of panelLayout(n, w, h)) {
        expect(p.x - 280 * p.k).toBeGreaterThanOrEqual(0);
        expect(p.x + 280 * p.k).toBeLessThanOrEqual(w);
      }
    }
  });
  it("el cierre se dibuja sin errores", () => {
    const s = spec(4, 20);
    const html = renderToString(<FrameProvider frame={200} config={{ fps: 30, width: 1080, height: 1920, durationInFrames: 1000 }}><ThemeProvider theme={neutral}><Closing spec={s} /></ThemeProvider></FrameProvider>);
    expect(html.length).toBeGreaterThan(100);
  });
});
