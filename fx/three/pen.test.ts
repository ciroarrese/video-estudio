import { describe, expect, it } from "vitest";
import { dark, editorial, neon, neutral, papel } from "../../themes";
import { dot, palette, penFor, poly, seg, shadeColor, strokeScale } from "./common";

/** Contexto 2D que anota cada operación y cada propiedad asignada, para comparar dos secuencias de dibujo. */
function recorder() {
  const log: string[] = [];
  const store: Record<string, unknown> = {};
  const ctx = new Proxy(store, {
    get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => void log.push(`${k}(${a.map((x) => (typeof x === "number" ? +x.toFixed(4) : String(x))).join(",")})`)),
    set: (t, k: string, v) => {
      t[k] = v;
      log.push(`${k}=${typeof v === "number" ? +v.toFixed(4) : String(v)}`);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

const pts = [{ x: 0, y: 0 }, { x: 40, y: 3 }, { x: 33, y: 52 }, { x: -4, y: 30 }];

describe("pluma de fx/three", () => {
  it("con neutral y dark hace exactamente las operaciones de seg, dot y poly de siempre", () => {
    for (const t of [neutral, dark]) {
      const pal = palette(t);
      const k = strokeScale(900, 900);
      const pen = penFor(t, pal, k);
      const a = recorder(), b = recorder();
      seg(a.ctx, 1, 2, 30, 40, pal.line, 0.5, 2 * k);
      pen.seg(b.ctx, 1, 2, 30, 40, pal.line, 0.5, 2 * k, { i: 3 });
      dot(a.ctx, 5, 6, 3, pal.accent, 0.7);
      pen.dot(b.ctx, 5, 6, 3, pal.accent, 0.7);
      poly(a.ctx, pts, shadeColor(pal.line, 0.4, pal), pal.bg, 2 * k);
      pen.face(b.ctx, pts, pal.line, 0.4, 2 * k, pal.bg);
      poly(a.ctx, pts, pal.bg, pal.line, 1.5, 0.6);
      pen.poly(b.ctx, pts, pal.bg, pal.line, 1.5, 0.6, true);
      expect(b.log, t.name).toEqual(a.log);
      expect(pen.byDepth(3, 2, 5, { minAlpha: 0.1 })).toEqual({ alpha: pen.byDepth(3, 2, 5, { minAlpha: 0.1 }).alpha, width: pen.byDepth(3, 2, 5, { minAlpha: 0.1 }).width });
      expect([pen.w, pen.glow, pen.bias, pen.sparse, pen.share(0.12), pen.every(4), pen.quiet("#123456")]).toEqual([1, 0, 0, false, 0.12, 4, "#123456"]);
    }
  });

  it("es una función pura: dos llamadas iguales dan la misma secuencia con cada tema", () => {
    for (const t of [editorial, neon, papel]) {
      const pal = palette(t);
      const run = () => {
        const r = recorder();
        const pen = penFor(t, pal, 1.8);
        pen.seg(r.ctx, 1, 2, 300, 80, pal.line, 0.9, 2);
        pen.dot(r.ctx, 5, 6, 3, pal.accent);
        pen.face(r.ctx, pts, pal.accent, 0.5, 2, pal.bg);
        pen.disc(r.ctx, 10, 10, 20, pal.accent, 1, { light: pal.lightest, dark: pal.darkest });
        return r.log;
      };
      expect(run()).toEqual(run());
    }
  });

  it("los temas de ejemplo dibujan distinto: grosor, forma de punto, halo y relleno", () => {
    const sig = (t: typeof neutral) => {
      const pal = palette(t);
      const r = recorder();
      const pen = penFor(t, pal, 1.8);
      pen.seg(r.ctx, 0, 0, 200, 20, pal.line, 1, 2);
      pen.dot(r.ctx, 5, 6, 3, pal.accent);
      pen.face(r.ctx, pts, pal.line, 0.5, 2, pal.bg);
      return r.log.length + ":" + r.log.filter((l) => l.startsWith("lineWidth")).join("|");
    };
    const s = [neutral, editorial, neon, papel].map(sig);
    expect(new Set(s).size).toBe(4);
  });
});
