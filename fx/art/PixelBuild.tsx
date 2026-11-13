import { Easing, holdRender, random, releaseRender } from "../../engine";
import { chartColor, fxBox, progress, useFx } from "../core";
import type { FxProps } from "../core";

export type PixelBuildProps = FxProps & {
  text?: string;
  /** Filas de cuadritos del texto (resolucion). */
  rows?: number;
};

export type Cell = { c: number; r: number };
type Cells = { cells: Cell[]; cols: number; rows: number };
/** Memoria acotada de celdas (función pura de su clave); la clave incluye la fuente ya resuelta. */
const cache = new Map<string, Cells>();
const CACHE_MAX = 24;
/** Cargas de fuente en curso (clave de fuente -> id de holdRender), para no frenar dos veces lo mismo. */
const loading = new Map<string, number>();

/** Si la fuente todavía no está disponible la pide y frena la captura (holdRender) hasta que cargue. Devuelve si ya está lista. */
function fontReady(font: string, text: string): boolean {
  const fonts = (document as unknown as { fonts?: { check(f: string, t?: string): boolean; load(f: string, t?: string): Promise<unknown> } }).fonts;
  if (!fonts) return true;
  let ok = true;
  try { ok = fonts.check(font, text); } catch { return true; }
  if (ok) return true;
  if (!loading.has(font)) {
    const id = holdRender("fx-art: fuente de PixelBuild");
    loading.set(font, id);
    const done = () => { loading.delete(font); releaseRender(id); };
    fonts.load(font, text).then(done, done);
  }
  return false;
}

/** Patron sembrado (para entornos sin canvas, p. ej. las pruebas): bloques por letra. */
export function fallbackCells(text: string, rows: number, seed: string | number): { cells: Cell[]; cols: number; rows: number } {
  const per = Math.max(3, Math.round(rows * 0.7));
  const cols = text.length * per + (text.length - 1) * 2;
  const cells: Cell[] = [];
  for (let ch = 0; ch < text.length; ch++) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < per; c++) {
      const edge = r === 0 || r === rows - 1 || c === 0 || c === per - 1;
      if (edge ? random(`${seed}:${ch}:${r}:${c}`) < 0.85 : random(`${seed}:i:${ch}:${r}:${c}`) < 0.18) cells.push({ c: ch * (per + 2) + c, r });
    }
  }
  return { cells, cols, rows };
}

/** Celdas ocupadas por el texto: muestrea la cobertura de los glifos en un canvas fuera de pantalla. */
export function glyphCells(text: string, family: string, weight: number, rows: number, seed: string | number): { cells: Cell[]; cols: number; rows: number } {
  const hasCanvas = typeof document !== "undefined" && typeof navigator !== "undefined" && !/jsdom/i.test(navigator.userAgent);
  const font = `${weight} ${rows * 8}px ${family}`;
  // Sin la fuente del tema cargada no se muestrea (saldría la de respaldo): se espera con holdRender y se dibuja el patrón sembrado mientras tanto.
  if (hasCanvas && !fontReady(font, text)) return fallbackCells(text, rows, seed);
  const key = `${text}|${font}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let res: { cells: Cell[]; cols: number; rows: number } | null = null;
  if (hasCanvas) {
    try {
      const px = rows * 8;
      const cv = document.createElement("canvas");
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.font = `${weight} ${px}px ${family}`;
        const tw = Math.ceil(ctx.measureText(text).width) + 8;
        cv.width = tw; cv.height = Math.ceil(px * 1.3);
        ctx.font = `${weight} ${px}px ${family}`;
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.fillText(text, 4, px);
        const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
        const cs = 8;
        const cols = Math.ceil(cv.width / cs), rws = Math.ceil(cv.height / cs);
        const all: Cell[] = [];
        for (let r = 0; r < rws; r++) for (let c = 0; c < cols; c++) {
          let a = 0;
          for (let y = 0; y < cs; y++) for (let x = 0; x < cs; x++) a += data[((r * cs + y) * cv.width + c * cs + x) * 4 + 3]!;
          if (a / (cs * cs) > 110) all.push({ c, r });
        }
        if (all.length) {
          const minC = Math.min(...all.map((q) => q.c)), maxC = Math.max(...all.map((q) => q.c));
          const minR = Math.min(...all.map((q) => q.r)), maxR = Math.max(...all.map((q) => q.r));
          res = { cells: all.map((q) => ({ c: q.c - minC, r: q.r - minR })), cols: maxC - minC + 1, rows: maxR - minR + 1 };
        }
      }
    } catch { res = null; }
  }
  const out = res ?? fallbackCells(text, rows, seed);
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, out);
  return out;
}

/** Texto o numero armado con cuadritos que vuelan a su lugar. */
export function PixelBuild(p: PixelBuildProps) {
  const { local, theme } = useFx(p);
  const { width: w, height: h } = fxBox(p, { width: 900, height: 360 });
  const dur = p.duration ?? 80;
  const seed = p.seed ?? "pixels";
  const g = glyphCells(p.text ?? "2025", theme.font.family, theme.font.weights.stat, p.rows ?? 10, seed);
  const cs = Math.min((w - 40) / g.cols, (h - 40) / g.rows);
  const ox = (w - g.cols * cs) / 2, oy = (h - g.rows * cs) / 2;
  const t = progress(local, 0, dur);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", ...p.style }}>
      {g.cells.map((q, i) => {
        const delay = random(`${seed}:d:${i}`) * 0.55;
        const e = Easing.lands(progress(t, delay, 0.45));
        if (e <= 0) return null;
        const ang = random(`${seed}:a:${i}`) * Math.PI * 2, dist = (260 + random(`${seed}:r:${i}`) * 360) * (1 - e);
        const x = ox + q.c * cs + cs / 2 + Math.cos(ang) * dist, y = oy + q.r * cs + cs / 2 + Math.sin(ang) * dist;
        const rot = (random(`${seed}:o:${i}`) - 0.5) * 540 * (1 - e);
        const s = cs * 0.86;
        const accent = random(`${seed}:c:${i}`) < 0.2;
        return <rect key={i} x={-s / 2} y={-s / 2} width={s} height={s} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(2)})`} fill={accent ? chartColor(theme, 1) : theme.color.accent} opacity={Math.min(1, e * 2)} />;
      })}
    </svg>
  );
}
