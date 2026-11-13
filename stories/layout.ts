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
  const len = Math.max(1, text.length);
  if (len * avg * size <= room) return { text, size };
  const s = room / (len * avg);
  if (s >= min) return { text, size: s };
  const maxChars = Math.max(1, Math.floor(room / (avg * min)));
  return { text: text.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…", size: min };
}

/** Ancho estimado de un texto (px). */
export const textWidth = (text: string, size: number, avg = AVG_BOLD) => text.length * avg * size;

/** Etiqueta `i` del muro: se repiten las dadas con un corrimiento por vuelta (sin repetir vecinas); sin etiquetas usa `fallback`. */
export function labelAt(labels: string[], i: number, fallback: string[]): string {
  const pool = labels.length ? labels : fallback.length ? fallback : ["·"];
  const n = pool.length;
  return pool[(i + Math.floor(i / n) * 3) % n]!;
}

export type Pt = { x: number; y: number };

// ---------------------------------------------------------------- lista de titulares

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
  barW: number;
  names: string[];
  lines: string[];
  /** Punto del mundo donde se atraviesa la fila `i` (sobre las primeras letras del nombre). */
  target: (i: number) => Pt;
};

/** Lista de titulares: la altura de fila y los tamaños de letra se escalan con la cantidad de temas y se ajustan al texto. */
export function listLayout(spec: StorySpec, theme: Theme, width: number, height: number): ListLayout {
  const n = spec.topics.length;
  const region = Math.max(600, width - 2 * theme.safe.x);
  const H = Math.max(300, height - 2 * theme.safe.y - 40);
  const rowH = Math.min(200, H / n);
  const bar = 6;
  // nameSize*(1.15 + 0.5*1.25) + gaps <= rowH - margen
  const base = Math.min(theme.type.h1 * 0.9, (rowH - 34) / 1.8);
  const numSize = Math.max(26, base * 0.45);
  const numW = Math.round(Math.max(base * 1.05, numSize * 2));
  const avail = region - numW;
  // un solo tamaño para todas las filas: el que necesita el nombre más largo (con piso ~44 px)
  const floor = Math.min(base, Math.max(44, base * 0.6));
  let nameSize = base;
  for (const t of spec.topics) nameSize = Math.min(nameSize, fitText(t.name, avail, base, { min: floor }).size);
  const names = spec.topics.map((t) => fitText(t.name, avail, nameSize, { min: nameSize }).text);
  const baseLine = Math.max(26, nameSize * 0.5);
  let lineSize = baseLine;
  for (const t of spec.topics) lineSize = Math.min(lineSize, fitText(t.line, avail, baseLine, { min: 26, avg: AVG_REG }).size);
  const lines = spec.topics.map((t) => fitText(t.line, avail, lineSize, { min: lineSize, avg: AVG_REG }).text);
  const nameH = Math.round(nameSize * 1.15);
  const lineH = Math.round(lineSize * 1.25);
  const blockH = nameH + 4 + lineH + 10 + bar;
  const blockTop = Math.round((rowH - blockH) / 2);
  const top = Math.max(height / 2 - (n * rowH) / 2 + (n >= 5 ? 0 : 25), theme.safe.y + 5);
  const nameW = Math.max(...names.map((s) => textWidth(s, nameSize, AVG_BOLD)));
  const lineW = Math.max(...lines.map((s) => textWidth(s, lineSize, AVG_REG)));
  const contentW = Math.min(region, numW + Math.max(nameW, lineW));
  const left = Math.max(theme.safe.x, Math.round((width - contentW) / 2));
  const barW = Math.min(avail, Math.max(260, nameW * 0.95));
  return {
    left, top, rowW: contentW, rowH, nameSize, lineSize, numSize, numW, nameH, lineH, blockTop, barW, names, lines,
    target: (i) => ({ x: left + numW + nameSize * 0.3, y: top + i * rowH + blockTop + nameH / 2 }),
  };
}

// ---------------------------------------------------------------- muro de etiquetas

export type WallChip = { x: number; y: number; text: string };

/** Muro de la apertura: 5 columnas × 6 filas en ladrillo; el azar solo mueve un poco cada pieza. */
export function openingWall(spec: StorySpec): (WallChip & { z: number; on: number })[] {
  const fallback = spec.topics.map((t) => t.name);
  const out: (WallChip & { z: number; on: number })[] = [];
  for (let i = 0; i < 30; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    out.push({
      text: labelAt(spec.labels, i, fallback),
      x: -820 + col * 410 + (row % 2) * 150 + (random(`x${i}`) - 0.5) * 40,
      y: -400 + row * 160 + (random(`y${i}`) - 0.5) * 24,
      z: -260 + random(`z${i}`) * 360,
      on: 14 + random(`on${i}`) * 62,
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
    const gap = cnt >= 3 ? 620 : 700;
    for (let j = 0; j < cnt; j++) out.push({ x: (j - (cnt - 1) / 2) * gap, y: r === 0 ? -100 : 100 });
  });
  return out;
}

const cellPos = (r: number, c: number): Pt => ({ x: -1200 + c * CELL.w + (((r % 2) + 2) % 2) * CELL.off, y: -500 + r * CELL.h });

/** Muro del cierre: grilla 6×6 sin las celdas que tapan los lugares reservados, más un anillo exterior que solo se ve al alejar la cámara. */
export function closingWall(spec: StorySpec): { inner: WallChip[]; outer: WallChip[]; slots: Pt[] } {
  const slots = reservedSlots(spec.topics.length);
  const fallback = spec.topics.map((t) => t.name);
  const inner: WallChip[] = [];
  const outer: WallChip[] = [];
  for (let r = -1; r <= 6; r++) {
    for (let c = -1; c <= 6; c++) {
      const p = cellPos(r, c);
      const inside = r >= 0 && r <= 5 && c >= 0 && c <= 5;
      if (inside && slots.some((s) => Math.abs(p.x - s.x) < 480 && Math.abs(p.y - s.y) < 120)) continue;
      const list = inside ? inner : outer;
      list.push({ ...p, text: labelAt(spec.labels, inside ? inner.length : outer.length * 11 + 5, fallback) });
    }
  }
  return { inner, outer, slots };
}

/** Disposición de los paneles flotantes del cierre según la cantidad de temas (`k` = escala del lienzo 560x340). */
export function panelLayout(n: number): { x: number; y: number; z: number; k: number }[] {
  const k = n === 2 ? 1.4 : n <= 4 ? 1.15 : 0.85;
  const rows = n === 2 ? [2] : [Math.ceil(n / 2), n - Math.ceil(n / 2)];
  const zs = [40, -120, -80, 60, 0, -60];
  const dx = n === 2 ? 440 : n <= 4 ? 400 : 520;
  const out: { x: number; y: number; z: number; k: number }[] = [];
  rows.forEach((cnt, r) => {
    const y = rows.length === 1 ? 540 : r === 0 ? 345 : 775;
    for (let j = 0; j < cnt; j++) {
      const x = cnt === 1 ? 960 : cnt === 2 ? 960 + (j === 0 ? -dx : dx) : 960 + (j - 1) * dx;
      out.push({ x, y, z: zs[out.length % zs.length]!, k });
    }
  });
  return out;
}

// ---------------------------------------------------------------- proyección 3D hecha a mano
// El navegador no rasteriza igual las capas 3D (translateZ / preserve-3d), los giros ni los sesgos según el
// historial de cuadros (el control de determinismo del render lo detecta). La profundidad se proyecta acá y cada
// pieza se dibuja solo con traslado y escala 2D. Se pierde la inclinación de los planos; se mantiene la paralaje.

/** Punto proyectado: posición en pantalla, escala total y la parte lineal (a, b, d) de la inclinación. */
export type Placed = { x: number; y: number; s: number; a: number; b: number; d: number; z: number };

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Solo escala (a = d = s, sin sesgo): una transformación con sesgo o giro hace que el rasterizado dependa del
 * historial de cuadros (el render lo detecta como no determinista); con escala y traslado queda idéntico.
 */
function tilt(_rx: number, _ry: number, s: number) {
  return { a: s, b: 0, d: s };
}

/**
 * Punto (x, y, z) de un grupo con `translateZ(dz) rotateX(rx) rotateY(ry)` visto con perspectiva `persp`
 * desde el centro; devuelve el desplazamiento respecto del centro de la pantalla (o null si queda detrás de la cámara).
 */
export function rigProject(x: number, y: number, z: number, rig: { dz: number; rx: number; ry: number }, persp: number): Placed | null {
  const ax = rad(rig.rx), ay = rad(rig.ry);
  const x1 = x * Math.cos(ay) + z * Math.sin(ay);
  const z1 = -x * Math.sin(ay) + z * Math.cos(ay);
  const y2 = y * Math.cos(ax) - z1 * Math.sin(ax);
  const z3 = y * Math.sin(ax) + z1 * Math.cos(ax) + rig.dz;
  if (persp - z3 < 60) return null;
  const fac = persp / (persp - z3);
  return { x: x1 * fac, y: y2 * fac, s: fac, z: z3, ...tilt(rig.rx, rig.ry, fac) };
}
