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
  /** Formato alto: la fila se apila (número arriba, nombre grande, línea en hasta 2 renglones). */
  stacked: boolean;
  /** Alto de la línea del número (solo apilada), separación hasta el nombre y renglones de la línea (cortados a mano). */
  numH: number;
  numGap: number;
  lineRows: string[][];
  /** Arriba y a la izquierda del subrayado dentro de la fila. */
  barTop: number;
  barLeft: number;
};

/** Parte un texto en renglones de a lo sumo `maxW` px (estimado sin medir); si pasa de `maxLines`, corta el último con "…". */
export function wrapText(text: string, maxW: number, size: number, maxLines: number, avg = AVG_REG): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && textWidth(next, size, avg) > maxW) { rows.push(cur); cur = w; } else cur = next;
  }
  if (cur) rows.push(cur);
  if (rows.length <= maxLines) return rows;
  const kept = rows.slice(0, maxLines);
  const last = Array.from(kept[maxLines - 1]!.replace(/[….,;]+$/, "")).join("");
  kept[maxLines - 1] = last + "…";
  return kept;
}

/**
 * Lista apilada para formato vertical (alto/ancho > 1,3): ocupa casi todo el ancho y buena parte del alto. Cada fila:
 * número (o tilde) arriba, nombre grande (~h1) y la línea debajo en hasta 2 renglones. Los tamaños salen de `theme.type`.
 */
function stackedLayout(spec: StorySpec, theme: Theme, width: number, height: number): ListLayout {
  const n = spec.topics.length;
  const marginX = Math.round(width * 0.085);
  const region = width - 2 * marginX;
  const H = height - 2 * Math.round(height * 0.07);
  const GAP = { num: 14, pad: 30 };
  const build = (sc: number) => {
    let nameSize = Math.round(theme.type.hero * sc);
    const floor = Math.round(Math.max(48, nameSize * 0.6));
    for (const t of spec.topics) nameSize = Math.min(nameSize, fitText(t.name, region, nameSize, { min: floor }).size);
    nameSize = Math.floor(nameSize);
    const names = spec.topics.map((t) => fitText(t.name, region, nameSize, { min: nameSize }).text);
    const base = Math.round(Math.max(30, theme.type.body * 1.15 * sc));
    let lineSize = base;
    // el mismo tamaño para todas: el más grande con el que cada línea entra en 2 renglones
    for (const t of spec.topics) {
      while (lineSize > 30 && wrapText(t.line, region, lineSize, 3).length > 2) lineSize -= 2;
    }
    const lineRows = spec.topics.map((t) => wrapText(t.line, region, lineSize, 2));
    const rowsN = Math.max(...lineRows.map((r) => r.length));
    const numSize = Math.round(Math.max(36, nameSize * 0.62));
    const numH = Math.round(numSize * 1.1);
    const nameH = Math.round(nameSize * 1.1);
    const lineH = Math.round(lineSize * 1.25);
    const blockH = numH + GAP.num + nameH + ROW_GAP.a + lineH * rowsN + ROW_GAP.b + ROW_GAP.bar;
    return { nameSize, names, lineSize, lineRows, rowsN, numSize, numH, nameH, lineH, blockH };
  };
  let sc = 1;
  let b = build(sc);
  for (let k = 0; k < 6 && b.blockH + GAP.pad > H / n; k++) {
    sc *= Math.max(0.5, (H / n - GAP.pad) / b.blockH);
    b = build(sc);
  }
  const rowH = Math.floor(Math.min(H / n, b.blockH * 1.8));
  const blockTop = Math.floor((rowH - b.blockH) / 2);
  const top = Math.round((height - n * rowH) / 2);
  const nameTop = blockTop + b.numH + GAP.num;
  const barTop = nameTop + b.nameH + ROW_GAP.a + b.lineH * b.rowsN + ROW_GAP.b;
  const left = marginX;
  return {
    left, top, rowW: region, rowH, nameSize: b.nameSize, lineSize: b.lineSize, numSize: b.numSize, numW: 0, nameH: b.nameH, lineH: b.lineH,
    blockTop, blockH: b.blockH, barW: region, names: b.names, lines: b.lineRows.map((r) => r.join(" ")),
    target: (i) => ({ x: left + b.nameSize * 0.8, y: top + i * rowH + nameTop + b.nameH / 2 }),
    stacked: true, numH: b.numH, numGap: GAP.num, lineRows: b.lineRows, barTop, barLeft: 0,
  };
}

/**
 * Lista de titulares: es lo más grande de la pantalla. Nombre ~0.8 × h1 y línea ~0.9 × body con filas de ~170 px hasta
 * 4 temas; con 5 o 6 todo se escala parejo (el nombre nunca baja de ~44 px). Todo en enteros: las posiciones
 * fraccionarias de capas compuestas se rasterizan según el historial de cuadros.
 */
export function listLayout(spec: StorySpec, theme: Theme, width: number, height: number): ListLayout {
  if (height / width > 1.3) return stackedLayout(spec, theme, width, height);
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
    stacked: false, numH: nameH, numGap: 0, lineRows: [], barTop: blockTop + nameH + ROW_GAP.a + lineH + ROW_GAP.b, barLeft: numW,
  };
}

// ---------------------------------------------------------------- muro de etiquetas

export type WallChip = { x: number; y: number; text: string };

/** Formato alto: el muro de la apertura es más denso y con piezas más grandes. */
export const isTall = (width: number, height: number) => height / width > 1.3;

/** Muro de la apertura: 6 columnas × 6 filas en ladrillo; el azar solo mueve un poco cada pieza y le da su profundidad. */
export function openingWall(spec: StorySpec, height = 1080, width = 1920): (WallChip & { z: number; on: number; k: number })[] {
  const fallback = spec.topics.map((t) => t.name);
  // En formatos altos las filas se separan más (el muro llena el alto); el ancho se corta solo (las piezas de afuera no se ven).
  const ky = height / 1080 > 1.2 ? height / 1080 : 1;
  const out: (WallChip & { z: number; on: number; k: number })[] = [];
  const tall = isTall(width, height);
  for (let i = 0; i < 36; i++) {
    const col = tall ? i % 3 : i % 6;
    const row = tall ? Math.floor(i / 3) : Math.floor(i / 6);
    if (tall) {
      // 3 columnas × 12 filas en ladrillo, piezas a escala 1,15 que cubren el alto del cuadro
      out.push({
        text: labelAt(spec.labels, i, fallback),
        x: Math.round((col - 1) * 410 + (row % 2 ? 100 : -100) + (random(`x${i}`) - 0.5) * 30),
        y: Math.round((row - 5.5) * (height / 12.2) + (random(`y${i}`) - 0.5) * 20),
        z: Math.round(-250 + random(`z${i}`) * 360),
        on: 10 + random(`on${i}`) * 60,
        k: 1.15,
      });
      continue;
    }
    out.push({
      text: labelAt(spec.labels, i, fallback),
      x: Math.round((col - 2.5) * 400 + (row % 2) * 200 - 100 + (random(`x${i}`) - 0.5) * 40),
      y: Math.round((-420 + row * 168) * ky + (random(`y${i}`) - 0.5) * 24),
      z: Math.round(-300 + random(`z${i}`) * 440),
      on: 10 + random(`on${i}`) * 60,
      k: 1,
    });
  }
  return out;
}

export const CELL = { w: 480, h: 200, off: 70 };

/** Lugares reservados en el centro del muro del cierre (dos filas, la de arriba con ceil(n/2)). */
export function reservedSlots(n: number, width = 1920, height = 1080): Pt[] {
  if (width / height < 1.3) {
    // Formato vertical o cuadrado: una sola columna centrada (las píldoras llegan a ~800 px de ancho al aterrizar).
    const gap = Math.min(220, Math.floor((height * 0.66) / Math.max(1, n - 1) / 0.8));
    return Array.from({ length: n }, (_, j) => ({ x: 0, y: Math.round((j - (n - 1) / 2) * gap) }));
  }
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
export function closingWall(spec: StorySpec, width = 1920, height = 1080): { inner: WallChip[]; outer: WallChip[]; slots: Pt[] } {
  const slots = reservedSlots(spec.topics.length, width, height);
  const fallback = spec.topics.map((t) => t.name);
  const inner: WallChip[] = [];
  const outer: WallChip[] = [];
  // Horizontal: la grilla de siempre. Vertical y cuadrado: se cubre lo que la cámara alcanza a ver al alejarse (escala ~0.55).
  const tall = width / height < 1.3;
  const halfW = width / 2 / 0.55, halfH = height / 2 / 0.55;
  const cols: [number, number] = tall ? [Math.ceil((-halfW - CELL.w + 1200) / CELL.w), Math.floor((halfW + CELL.w + 1200) / CELL.w)] : [-3, 8];
  const rows: [number, number] = tall ? [Math.ceil((-halfH - CELL.h + 500) / CELL.h), Math.floor((halfH + CELL.h + 500) / CELL.h)] : [-2, 7];
  const slotY = Math.max(...slots.map((s) => Math.abs(s.y)));
  for (let r = rows[0]; r <= rows[1]; r++) {
    for (let c = cols[0]; c <= cols[1]; c++) {
      const p = cellPos(r, c);
      const inside = tall ? Math.abs(p.x) <= 1300 && Math.abs(p.y) <= slotY + 450 : r >= 0 && r <= 5 && c >= 0 && c <= 5;
      if (slots.some((s) => Math.abs(p.x - s.x) < SLOT_CLEAR.x && Math.abs(p.y - s.y) < SLOT_CLEAR.y)) continue;
      const list = inside ? inner : outer;
      list.push({ ...p, text: labelAt(spec.labels, inside ? inner.length : outer.length * 11 + 5, fallback) });
    }
  }
  return { inner, outer, slots };
}

export type PanelPlace = { x: number; y: number; z: number; k: number };

/** La píldora de cada panel va sobre su borde superior: su centro queda `PILL_OFF` px (del lienzo, sin escalar) arriba del panel. */
export const PILL_OFF = -50;
/** Hueco libre que cada panel necesita arriba para su píldora (px): mitad del alto máximo de la píldora (~76 px) + PILL_OFF. */
export const PILL_BAND = 90;
/** Separación vertical mínima entre filas de paneles: cabe la píldora de la fila de abajo y sobra margen para el vaivén y la perspectiva. */
const ROW_GAP_Y = 140;

/** Letra mínima de la píldora cuando hay que achicarla para que entre en su lugar (relativa a `type.caption`). */
const PILL_MIN = 0.68;

/**
 * Tamaño y texto de la píldora del cierre. Sin `maxW`: letra `caption * 1.06` y hasta 560 px de texto. Con `maxW` (ancho total de la
 * píldora, bordes incluidos): se achica la letra hasta `PILL_MIN * caption` y después se corta con "…", para que dos píldoras vecinas no se pisen.
 */
export function pillFit(theme: Theme, name: string, maxW?: number): { text: string; size: number; numSize: number; w: number; h: number } {
  const base = theme.type.caption * 1.06;
  const over = (size: number) => 2 * size * 0.9 + 6 + 16 + Math.max(26, size * 0.8) * 0.56 * 2;
  const t = maxW === undefined ? fitText(name, 560, base, { min: theme.type.caption * 0.8 }) : fitText(name, Math.max(60, maxW - over(base)), base, { min: theme.type.caption * PILL_MIN });
  return { text: t.text, size: t.size, numSize: Math.max(26, t.size * 0.8), w: Math.round(textWidth(t.text, t.size) + over(t.size)), h: Math.round(t.size * 1.25 + 2 * t.size * 0.42 + 6) };
}

/** Zoom máximo de la cámara del cierre (arranca en 1,1) y holgura (px) que se deja por la perspectiva y la inclinación de los paneles. */
const CLOSING_CAM_MAX = 1.1, CLOSING_EDGE_SLACK = 32;

/**
 * Ancho máximo de la píldora del panel `i`: la distancia al panel vecino de su fila (menos 24 px de aire) y lo que entra entre su
 * centro y el borde del cuadro contando el zoom inicial de la cámara (1,1) y 32 px de holgura por la inclinación; con tope en 900 px.
 */
export function pillBudget(panels: PanelPlace[], i: number, width: number): number {
  const c = panels[i]!;
  const d = Math.abs(c.x - width / 2);
  let b = Math.min(900, 2 * ((width / 2 - CLOSING_EDGE_SLACK) / (CLOSING_CAM_MAX * 1.03) - d));
  for (const o of panels) if (o !== c && Math.abs(o.y - c.y) < 1) b = Math.min(b, Math.abs(o.x - c.x) - 24);
  return Math.max(120, Math.floor(b));
}

/** Rectángulo de pantalla (en reposo) del panel `c` y de su píldora. */
export function panelRects(c: PanelPlace, theme: Theme, name = "", maxW?: number) {
  const W = 560 * c.k, H = 340 * c.k;
  const pill = pillFit(theme, name, maxW);
  const cy = c.y - H / 2 + PILL_OFF;
  return { panel: { x: c.x - W / 2, y: c.y - H / 2, w: W, h: H }, pill: { x: c.x - pill.w / 2, y: cy - pill.h / 2, w: pill.w, h: pill.h } };
}

/**
 * Disposición de los paneles flotantes del cierre según la cantidad de temas (`k` = escala del lienzo 560x340).
 * Invariante: entre una fila y la siguiente queda un hueco de `ROW_GAP_Y` (>= lo que ocupa la píldora de la fila de abajo),
 * y sobre la primera fila queda `PILL_BAND`; así ninguna píldora cae sobre el panel de otro tema.
 */
export function panelLayout(n: number, width = 1920, height = 1080): PanelPlace[] {
  if (width / height < 1.3) return panelGrid(n, width, height);
  const kBase = n === 2 ? 1.4 : n <= 4 ? 1.2 : 0.95;
  const rows = n === 2 ? [2] : [Math.ceil(n / 2), n - Math.ceil(n / 2)];
  // alto disponible: sin la banda de la píldora arriba (+24) ni 40 px abajo; la escala baja si no entran las filas con su hueco
  const top = PILL_BAND + 24, avail = height - top - 40;
  const k = Math.min(kBase, (avail - (rows.length - 1) * ROW_GAP_Y) / (rows.length * PANEL_H));
  const H = PANEL_H * k;
  const block = rows.length * H + (rows.length - 1) * ROW_GAP_Y;
  const y0 = top + (avail - block) / 2 + H / 2;
  const zs = [30, -90, -60, 50, 0, -40];
  const dx = n === 2 ? 440 : n <= 4 ? 420 : 570;
  const out: PanelPlace[] = [];
  rows.forEach((cnt, r) => {
    const y = Math.round(y0 + r * (H + ROW_GAP_Y));
    const step = cnt === 2 && rows[0] === 3 ? dx / 2 : dx;
    for (let j = 0; j < cnt; j++) {
      const x = cnt === 1 ? width / 2 : cnt === 2 ? width / 2 + (j === 0 ? -step : step) : width / 2 + (j - 1) * step;
      out.push({ x, y, z: zs[out.length % zs.length]!, k: Math.round(k * 1000) / 1000 });
    }
  });
  return out;
}

/**
 * Paneles en formato vertical o cuadrado: una columna (vertical, hasta 3 temas) o dos columnas, con la escala `k` que
 * entra en el ancho seguro y en el alto. Entre filas queda `ROW_GAP_Y` (la píldora del panel de abajo) y arriba `PILL_BAND`.
 */
function panelGrid(n: number, width: number, height: number): PanelPlace[] {
  const cols = width >= height || n > 3 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const gapX = 36;
  const availW = width - 2 * 80;
  const top = PILL_BAND + 40, availH = height - top - 80;
  const k = Math.min(1.4, (availW - (cols - 1) * gapX) / (cols * PANEL_W), (availH - (rows - 1) * ROW_GAP_Y) / (rows * PANEL_H));
  const zs = [30, -90, -60, 50, 0, -40];
  const cw = PANEL_W * k, ch = PANEL_H * k;
  const block = rows * ch + (rows - 1) * ROW_GAP_Y;
  const y0 = top + (availH - block) / 2 + ch / 2;
  const out: PanelPlace[] = [];
  for (let r = 0; r < rows; r++) {
    const cnt = Math.min(cols, n - r * cols);
    for (let j = 0; j < cnt; j++) {
      out.push({
        x: Math.round(width / 2 + (j - (cnt - 1) / 2) * (cw + gapX)),
        y: Math.round(y0 + r * (ch + ROW_GAP_Y)),
        z: zs[out.length % zs.length]!,
        k: Math.round(k * 1000) / 1000,
      });
    }
  }
  return out;
}

const PANEL_W = 560, PANEL_H = 340;

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
