import type { Theme } from "../themes";
import type { StorySpec } from "./types";
import { random } from "../engine";

/** Ancho medio de un glifo (en em) para texto en negrita / normal: heurística sin medir. */
export const AVG_BOLD = 0.56;
export const AVG_REG = 0.52;

export type FitOptions = { min?: number; avg?: number; lines?: number };

/**
 * Ajusta un texto a un ancho sin medirlo: ancho ≈ caracteres × glifo medio × tamaño.
 * Reduce el tamaño hasta `min` (por defecto 55 % del base); si aun así no entra, lo corta con "…".
 */
export function fitText(text: string, maxWidth: number, size: number, { min = size * 0.55, avg = AVG_BOLD, lines = 1 }: FitOptions = {}): { text: string; size: number } {
  const room = Math.max(40, maxWidth) * lines * (lines > 1 ? 0.88 : 1);
  const chars = Array.from(text);
  const len = Math.max(1, chars.length);
  if (len * avg * size <= room) return { text, size };
  const s = room / (len * avg);
  if (s >= min) return { text, size: s };
  const maxChars = Math.max(1, Math.floor(room / (avg * min)));
  return { text: chars.slice(0, Math.max(0, maxChars - 1)).join("").trimEnd() + "…", size: min };
}

/** Ancho estimado de un texto (px). */
export const textWidth = (text: string, size: number, avg = AVG_BOLD) => Array.from(text).length * avg * size;

/** Cuántos lugares separan a dos etiquetas vecinas en vertical en el muro (6 columnas). */
const WALL_COLS = 6;
const shiftCache = new Map<number, number>();

/**
 * Corrimiento por vuelta para `n` etiquetas: el más chico que evita repetir la vecina de al lado (`i`, `i+1`, también en
 * el borde entre vueltas) y la de la fila de abajo (`i`, `i+6`). Con n = 2 la de abajo es imposible (con dos etiquetas
 * alternando, `i+6` siempre cae igual): ahí se garantiza solo la de al lado.
 */
function lapShift(n: number): number {
  const hit = shiftCache.get(n);
  if (hit !== undefined) return hit;
  const f = (j: number, s: number) => (j + Math.floor(j / n) * s) % n;
  let pick = 0;
  for (let s = 0; s < n; s++) {
    let ok = true;
    // la coincidencia depende solo de i módulo n: alcanza con mirar una vuelta
    for (let i = 0; i < n * 2 && ok; i++) {
      if (f(i, s) === f(i + 1, s)) ok = false;
      if (n > 2 && f(i, s) === f(i + WALL_COLS, s)) ok = false;
    }
    if (ok) { pick = s; break; }
  }
  shiftCache.set(n, pick);
  return pick;
}

/**
 * Etiqueta `i` del muro: se repiten las dadas con un corrimiento por vuelta; sin etiquetas usa `fallback`.
 * Las vecinas (`i` con `i+1`, y con `i+6` si hay 3 o más etiquetas) nunca coinciden; con una sola etiqueta no hay alternativa.
 */
export function labelAt(labels: string[] | undefined, i: number, fallback: string[]): string {
  const pool = labels?.length ? labels : fallback.length ? fallback : ["·"];
  const n = pool.length;
  return pool[(i + Math.floor(i / n) * lapShift(n)) % n]!;
}

export type Pt = { x: number; y: number };

// ---------------------------------------------------------------- lista de titulares

/** Separaciones fijas dentro de una fila (px): nombre → línea, línea → subrayado, grosor del subrayado. */
export const ROW_GAP = { a: 2, b: 10, bar: 8 };

export type ListLayout = {
  left: number;
  top: number;
  rowW: number;
  rowH: number;
  nameSize: number;
  lineSize: number;
  numSize: number;
  numW: number;
  nameH: number;
  lineH: number;
  blockTop: number;
  blockH: number;
  barW: number;
  names: string[];
  lines: string[];
  /** Punto del mundo donde se atraviesa la fila `i` (sobre las primeras letras del nombre). */
  target: (i: number) => Pt;
};

/**
 * Lista de titulares: es lo más grande de la pantalla. Nombre ~0.8 × h1 y línea ~0.9 × body con filas de ~170 px hasta
 * 4 temas; con 5 o 6 todo se escala parejo (el nombre nunca baja de ~44 px). Todo en enteros: las posiciones
 * fraccionarias de capas compuestas se rasterizan según el historial de cuadros.
 */
export function listLayout(spec: StorySpec, theme: Theme, width: number, height: number): ListLayout {
  const n = spec.topics.length;
  const region = Math.max(600, width - 2 * theme.safe.x);
  const H = Math.max(300, height - 2 * theme.safe.y - 20);
  const nameBase = theme.type.h1 * 0.8;
  const lineBase = theme.type.body * 0.9;
  const blockBase = nameBase * 1.1 + ROW_GAP.a + lineBase * 1.2 + ROW_GAP.b + ROW_GAP.bar;
  const rowH = Math.floor(Math.min(blockBase + 22, H / n));
  const sc = Math.min(1, (rowH - 22) / blockBase);
  const base = nameBase * sc;
  const numSize = Math.max(26, Math.round(base * 0.6));
  const numW = Math.round(Math.max(base * 1.45, numSize * 2.2));
  const avail = region - numW;
  // un solo tamaño para todas las filas: el que necesita el nombre más largo (piso ~44 px)
  const floor = Math.min(base, Math.max(44, base * 0.6));
  let nameSize = base;
  for (const t of spec.topics) nameSize = Math.min(nameSize, fitText(t.name, avail, base, { min: floor }).size);
  nameSize = Math.round(nameSize);
  const names = spec.topics.map((t) => fitText(t.name, avail, nameSize, { min: nameSize }).text);
  const baseLine = Math.max(26, Math.min(lineBase * sc, nameSize * 0.55));
  let lineSize = baseLine;
  for (const t of spec.topics) lineSize = Math.min(lineSize, fitText(t.line, avail, baseLine, { min: 26, avg: AVG_REG }).size);
  lineSize = Math.round(lineSize);
  const lines = spec.topics.map((t) => fitText(t.line, avail, lineSize, { min: lineSize, avg: AVG_REG }).text);
  const nameH = Math.round(nameSize * 1.1);
  const lineH = Math.round(lineSize * 1.2);
  const blockH = nameH + ROW_GAP.a + lineH + ROW_GAP.b + ROW_GAP.bar;
  const blockTop = Math.floor((rowH - blockH) / 2);
  const top = Math.round((height - n * rowH) / 2);
  const nameW = Math.max(...names.map((s) => textWidth(s, nameSize, AVG_BOLD)));
  const lineW = Math.max(...lines.map((s) => textWidth(s, lineSize, AVG_REG)));
  // la lista ocupa buena parte del ancho seguro: el subrayado llega hasta el borde derecho de la columna
  const rowW = Math.round(Math.min(region, Math.max(numW + Math.max(nameW, lineW), region * 0.78)));
  const left = Math.round((width - rowW) / 2);
  const barW = rowW - numW;
  return {
    left, top, rowW, rowH, nameSize, lineSize, numSize, numW, nameH, lineH, blockTop, blockH, barW, names, lines,
    target: (i) => ({ x: left + numW + nameSize * 0.3, y: top + i * rowH + blockTop + nameH / 2 }),
  };
}

// ---------------------------------------------------------------- muro de etiquetas

export type WallChip = { x: number; y: number; text: string };

/** Muro de la apertura: 6 columnas × 6 filas en ladrillo; el azar solo mueve un poco cada pieza y le da su profundidad. */
export function openingWall(spec: StorySpec): (WallChip & { z: number; on: number })[] {
  const fallback = spec.topics.map((t) => t.name);
  const out: (WallChip & { z: number; on: number })[] = [];
  for (let i = 0; i < 36; i++) {
    const col = i % 6;
    const row = Math.floor(i / 6);
    out.push({
      text: labelAt(spec.labels, i, fallback),
      x: Math.round((col - 2.5) * 400 + (row % 2) * 200 - 100 + (random(`x${i}`) - 0.5) * 40),
      y: Math.round(-420 + row * 168 + (random(`y${i}`) - 0.5) * 24),
      z: Math.round(-300 + random(`z${i}`) * 440),
      on: 10 + random(`on${i}`) * 60,
    });
  }
  return out;
}

export const CELL = { w: 480, h: 200, off: 70 };

/** Lugares reservados en el centro del muro del cierre (dos filas, la de arriba con ceil(n/2)). */
export function reservedSlots(n: number): Pt[] {
  const top = Math.ceil(n / 2);
  const rows = [top, n - top];
  const out: Pt[] = [];
  rows.forEach((cnt, r) => {
    const gap = cnt >= 3 ? 780 : 820;
    for (let j = 0; j < cnt; j++) out.push({ x: Math.round((j - (cnt - 1) / 2) * gap), y: r === 0 ? -110 : 110 });
  });
  return out;
}

const cellPos = (r: number, c: number): Pt => ({ x: -1200 + c * CELL.w + (((r % 2) + 2) % 2) * CELL.off, y: -500 + r * CELL.h });

/** Mitad del ancho que tapa una píldora reservada (más la mitad de una etiqueta vecina), y mitad del alto. */
export const SLOT_CLEAR = { x: 540, y: 150 };

/**
 * Muro del cierre: grilla de etiquetas sin las celdas que tapan los lugares reservados, más un anillo exterior
 * (que solo se ve al alejar la cámara) que llena el cuadro cuando el muro se aleja.
 */
export function closingWall(spec: StorySpec): { inner: WallChip[]; outer: WallChip[]; slots: Pt[] } {
  const slots = reservedSlots(spec.topics.length);
  const fallback = spec.topics.map((t) => t.name);
  const inner: WallChip[] = [];
  const outer: WallChip[] = [];
  for (let r = -2; r <= 7; r++) {
    for (let c = -3; c <= 8; c++) {
      const p = cellPos(r, c);
      const inside = r >= 0 && r <= 5 && c >= 0 && c <= 5;
      if (slots.some((s) => Math.abs(p.x - s.x) < SLOT_CLEAR.x && Math.abs(p.y - s.y) < SLOT_CLEAR.y)) continue;
      const list = inside ? inner : outer;
      list.push({ ...p, text: labelAt(spec.labels, inside ? inner.length : outer.length * 11 + 5, fallback) });
    }
  }
  return { inner, outer, slots };
}

export type PanelPlace = { x: number; y: number; z: number; k: number };

/** Disposición de los paneles flotantes del cierre según la cantidad de temas (`k` = escala del lienzo 560x340). */
export function panelLayout(n: number): PanelPlace[] {
  const k = n === 2 ? 1.4 : n <= 4 ? 1.2 : 0.95;
  const rows = n === 2 ? [2] : [Math.ceil(n / 2), n - Math.ceil(n / 2)];
  const zs = [30, -90, -60, 50, 0, -40];
  const dx = n === 2 ? 440 : n <= 4 ? 420 : 570;
  const out: PanelPlace[] = [];
  rows.forEach((cnt, r) => {
    const y = rows.length === 1 ? 570 : r === 0 ? 335 : 800;
    const step = cnt === 2 && rows[0] === 3 ? dx / 2 : dx;
    for (let j = 0; j < cnt; j++) {
      const x = cnt === 1 ? 960 : cnt === 2 ? 960 + (j === 0 ? -step : step) : 960 + (j - 1) * step;
      out.push({ x, y, z: zs[out.length % zs.length]!, k });
    }
  });
  return out;
}

// ---------------------------------------------------------------- proyección 3D

const rad = (deg: number) => (deg * Math.PI) / 180;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export type Rig = { dz: number; rx: number; ry: number };

/**
 * Transformación CSS de una pieza plana ubicada en (x, y, z) de un plano con `translateZ(dz) rotateX(rx) rotateY(ry)`
 * visto con perspectiva `persp` desde (cx, cy). Cada pieza lleva su propia perspectiva (no hay `preserve-3d` ni
 * `perspective` en un ancestro): el orden de profundidad se resuelve con `zIndex`, y no hay planos que se crucen.
 * Va con `position:absolute; left:0; top:0; transform-origin:0 0` y todo el movimiento dentro de la transformación
 * (una `top`/`left` fraccionaria en una capa 3D se rasteriza distinto según el historial de cuadros).
 */
export function rigTransform(x: number, y: number, z: number, rig: Rig, persp: number, cx: number, cy: number, extra = ""): string {
  return `translate(${cx}px, ${cy}px) perspective(${persp}px) translateZ(${r3(rig.dz)}px) rotateX(${r3(rig.rx)}deg) rotateY(${r3(rig.ry)}deg) translate3d(${r3(x)}px, ${r3(y)}px, ${r3(z)}px)${extra}`;
}

/** Punto proyectado: posición respecto del centro de la pantalla, factor de escala y profundidad. */
export type Placed = { x: number; y: number; s: number; z: number };

/** Misma cuenta que `rigTransform`, para saber dónde cae un punto en pantalla (o null si queda detrás de la cámara). */
export function rigProject(x: number, y: number, z: number, rig: Rig, persp: number): Placed | null {
  const ax = rad(rig.rx), ay = rad(rig.ry);
  const x1 = x * Math.cos(ay) + z * Math.sin(ay);
  const z1 = -x * Math.sin(ay) + z * Math.cos(ay);
  const y2 = y * Math.cos(ax) - z1 * Math.sin(ax);
  const z3 = y * Math.sin(ax) + z1 * Math.cos(ax) + rig.dz;
  if (persp - z3 < 60) return null;
  const fac = persp / (persp - z3);
  return { x: x1 * fac, y: y2 * fac, s: fac, z: z3 };
}
