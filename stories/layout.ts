import type { Theme } from "../themes";
import { textWidth as kitTextWidth } from "../kit/text";
import { listOptions, wallOptions } from "./types";
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
  /**
   * Renglones del nombre de cada fila (formatos angostos: vertical y cuadrado, donde el nombre puede ocupar hasta dos renglones; con letra ya achicada
   * al piso, tres). Sin él (formato ancho) el nombre es `names[i]` en un solo renglón. `names[i]` es lo mismo con los renglones unidos por un espacio.
   */
  nameRows?: string[][];
  /** Ancho (px, medido) del renglón de texto más ancho de la lista, sin contar el número (solo los formatos angostos). */
  textW?: number;
  /** Arriba y a la izquierda del subrayado dentro de la fila. */
  barTop: number;
  barLeft: number;
  /** Fila en un solo renglón (`01 Nombre · línea`); en `lines` va la línea ya ajustada y `lineSize` es su tamaño. */
  inline?: boolean;
  /** Largo (px) del subrayado completo de cada fila: `barW` (`list.underline: "row"`) o lo que mide el nombre (`"name"`). */
  barWs: number[];
};


// ---------------------------------------------------------------- ajuste de texto medido (formatos angostos)

/** Mide un texto (px) con la tipografía real del tema (`kit/textWidth`, puro: canvas en el navegador, estimación por glifo en jsdom). */
export type RowMeter = (text: string, size: number) => number;
/** Holgura sobre lo medido: una fuente de reemplazo apenas más ancha no desborda la fila. */
const FIT_SAFETY = 1.03;
/** Medidor del nombre de una fila (rol `title`, el peso y el interletrado del design system). */
export const nameMeter = (theme: Theme): RowMeter => (text, size) => kitTextWidth(theme, text, { size, role: "title" }) * FIT_SAFETY;
/** Medidor de la línea de apoyo (rol `caption`). */
export const lineMeter = (theme: Theme): RowMeter => (text, size) => kitTextWidth(theme, text, { size, role: "caption" }) * FIT_SAFETY;

/** Parte un texto por palabras en renglones de a lo sumo `maxW` px medidos; una palabra sola más ancha que `maxW` queda en su renglón (desborda). */
export function wrapMeasured(text: string, maxW: number, size: number, meter: RowMeter): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && meter(next, size) > maxW) { rows.push(cur); cur = w; } else cur = next;
  }
  if (cur) rows.push(cur);
  return rows.length ? rows : [""];
}

/** Corta `text` con "…" hasta que entre en `maxW` (solo para la bajada, y solo como último recurso). */
function ellipsize(text: string, maxW: number, size: number, meter: RowMeter): string {
  const chars = Array.from(text);
  let n = chars.length;
  while (n > 1 && meter(chars.slice(0, n).join("").trimEnd() + "…", size) > maxW) n--;
  return chars.slice(0, n).join("").replace(/[\s.,;:]+$/, "") + "…";
}

/** Reparte el texto en `n` renglones lo más parejos posible (sin pasar de `maxW`): evita una palabra huérfana en el segundo renglón. */
function balancedRows(text: string, maxW: number, size: number, meter: RowMeter, n: number): string[] {
  let lo = maxW / n, hi = maxW;
  let best = wrapMeasured(text, maxW, size, meter);
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    const r = wrapMeasured(text, mid, size, meter);
    if (r.length <= n && r.every((x) => meter(x, size) <= maxW)) { best = r; hi = mid; } else lo = mid;
  }
  return best;
}

export type RowsFit = { size: number; rows: string[][] };

/**
 * Acomoda varios textos con UN solo tamaño de letra (el del que más necesita), midiéndolos. El orden es siempre el mismo: primero usar todo el
 * ancho (`width`), después partir en hasta `maxRows` renglones y recién al final achicar la letra, de `size` hacia `min`. Si ni así entra:
 *  - sin `ellipsis` (el nombre de un tema): un renglón más y letra hasta `hardMin`; un nombre nunca se corta con "…";
 *  - con `ellipsis` (la bajada): se corta con "…" el último renglón, con la letra en `min`.
 */
export function fitRowsUniform(texts: string[], o: { width: number; size: number; min: number; hardMin?: number; maxRows: number; meter: RowMeter; ellipsis?: boolean }): RowsFit {
  const min = Math.min(o.min, o.size);
  const hardMin = Math.min(o.hardMin ?? min, min);
  const fits = (t: string, s: number, maxRows: number) => {
    const r = wrapMeasured(t, o.width, s, o.meter);
    return r.length <= maxRows && r.every((x) => o.meter(x, s) <= o.width);
  };
  const sizeFor = (t: string): number => {
    for (let s = Math.floor(o.size); s >= Math.floor(min); s--) if (fits(t, s, o.maxRows)) return s;
    if (o.ellipsis) return Math.floor(min);
    for (let s = Math.floor(min); s >= Math.floor(hardMin); s--) if (fits(t, s, o.maxRows + 1)) return s;
    return Math.floor(hardMin);
  };
  const size = texts.length ? Math.min(...texts.map(sizeFor)) : Math.floor(o.size);
  const rows = texts.map((t) => {
    const r = wrapMeasured(t, o.width, size, o.meter);
    if (!o.ellipsis) return r.length > 1 ? balancedRows(t, o.width, size, o.meter, r.length) : r;
    if (r.length <= o.maxRows && r.every((x) => o.meter(x, size) <= o.width)) return r.length > 1 ? balancedRows(t, o.width, size, o.meter, r.length) : r;
    const kept = r.slice(0, o.maxRows - 1);
    return [...kept, ellipsize(r.slice(o.maxRows - 1).join(" "), o.width, size, o.meter)];
  });
  return { size, rows };
}

/** Ancho (px) del renglón más ancho de unos renglones. */
const widest = (rows: string[][], size: number, meter: RowMeter) => Math.max(0, ...rows.flat().map((r) => meter(r, size) / FIT_SAFETY));

/** Formatos angostos (vertical y cuadrado): la lista acomoda el texto midiéndolo (ver `fitRowsUniform`). */
const isNarrow = (width: number, height: number) => width / height < 1.3;

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
function stackedLayout(spec: StorySpec, theme: Theme, width: number, height: number): Omit<ListLayout, "barWs"> {
  const n = spec.topics.length;
  const marginX = Math.round(width * 0.085);
  const region = width - 2 * marginX;
  const H = height - 2 * Math.round(height * 0.07);
  const GAP = { num: 14, pad: 30 };
  const nm = nameMeter(theme), lm = lineMeter(theme);
  const build = (sc: number) => {
    const base0 = Math.round(theme.type.hero * sc);
    const floor = Math.round(Math.max(48, base0 * 0.6));
    // el nombre: todo el ancho, después hasta dos renglones y recién al final letra más chica; nunca "…"
    const nf = fitRowsUniform(spec.topics.map((t) => t.name), { width: region, size: base0, min: floor, hardMin: Math.round(Math.max(30, theme.type.caption)), maxRows: 2, meter: nm });
    const nameSize = Math.floor(nf.size);
    const nameRows = nf.rows;
    const nameRowsN = Math.max(...nameRows.map((r) => r.length));
    const base = Math.round(Math.max(30, theme.type.body * 1.15 * sc));
    // la bajada: el mismo tamaño para todas, en hasta 2 renglones; "…" solo si ni con la letra mínima entra
    const lf = fitRowsUniform(spec.topics.map((t) => t.line), { width: region, size: base, min: 30, maxRows: 2, meter: lm, ellipsis: true });
    const lineSize = lf.size;
    const lineRows = lf.rows;
    const rowsN = Math.max(...lineRows.map((r) => r.length));
    const numSize = Math.round(Math.max(36, nameSize * 0.62));
    const numH = Math.round(numSize * 1.1);
    const nameH = Math.round(nameSize * 1.1);
    const lineH = Math.round(lineSize * 1.25);
    const blockH = numH + GAP.num + nameH * nameRowsN + ROW_GAP.a + lineH * rowsN + ROW_GAP.b + ROW_GAP.bar;
    const textW = Math.max(widest(nameRows, nameSize, nm), widest(lineRows, lineSize, lm));
    return { nameSize, nameRows, nameRowsN, lineSize, lineRows, rowsN, numSize, numH, nameH, lineH, blockH, textW };
  };
  let sc = 1;
  let b = build(sc);
  // si no entra en el alto, se achica todo parejo (con paso mínimo: al achicar, un nombre de dos renglones puede pasar a uno) hasta el piso legible de la letra
  const scMin = Math.min(1, 52 / theme.type.hero);
  for (let k = 0; k < 40 && b.blockH + GAP.pad > H / n && sc > scMin; k++) {
    sc = Math.max(scMin, sc * Math.min(0.97, Math.max(0.5, (H / n - GAP.pad) / b.blockH)));
    b = build(sc);
  }
  // con la letra ya en el piso y sin entrar: la lista usa casi todo el alto del cuadro (más vale pasar el área segura que cortar un nombre)
  const Hrow = b.blockH + GAP.pad > H / n ? Math.max(H, height - 2 * Math.round(height * 0.03)) : H;
  const rowH = Math.floor(Math.min(Hrow / n, b.blockH * 1.8));
  const blockTop = Math.floor((rowH - b.blockH) / 2);
  const top = Math.round((height - n * rowH) / 2);
  const nameTop = blockTop + b.numH + GAP.num;
  const barTop = nameTop + b.nameH * b.nameRowsN + ROW_GAP.a + b.lineH * b.rowsN + ROW_GAP.b;
  const left = marginX;
  return {
    left, top, rowW: region, rowH, nameSize: b.nameSize, lineSize: b.lineSize, numSize: b.numSize, numW: 0, nameH: b.nameH, lineH: b.lineH,
    blockTop, blockH: b.blockH, barW: region, names: b.nameRows.map((r) => r.join(" ")), lines: b.lineRows.map((r) => r.join(" ")),
    // Lista apilada: se atraviesa por el centro del ancho de la fila (no por las primeras letras del nombre), así el zoom no empuja la línea hacia fuera del cuadro angosto.
    target: (i) => ({ x: left + region / 2, y: top + i * rowH + nameTop + b.nameH / 2 }),
    stacked: true, numH: b.numH, numGap: GAP.num, lineRows: b.lineRows, nameRows: b.nameRows, textW: Math.round(b.textW), barTop, barLeft: 0,
  };
}

/**
 * Lista de un cuadro angosto que no es alto (cuadrado, 4:5): como la de formato ancho, con el número a la izquierda y el texto en columna, pero el
 * nombre y la bajada se acomodan midiéndolos: todo el ancho seguro, después hasta dos renglones cada uno y recién al final letra más chica (hasta un
 * piso legible). Nunca "…" en el nombre; en la bajada, solo si ni así entra.
 */
function columnLayout(spec: StorySpec, theme: Theme, width: number, height: number): Omit<ListLayout, "barWs"> {
  const n = spec.topics.length;
  const region = Math.max(600, width - 2 * theme.safe.x);
  const H = Math.max(300, height - 2 * theme.safe.y - 20);
  const nm = nameMeter(theme), lm = lineMeter(theme);
  const nameBase = theme.type.h1 * 0.8;
  const lineBase = theme.type.body * 0.9;
  const build = (sc: number) => {
    const base = nameBase * sc;
    const numSize = Math.max(26, Math.round(base * 0.6));
    const numW = Math.round(Math.max(base * 1.45, numSize * 2.2));
    const avail = region - numW;
    const floor = Math.min(base, Math.max(44, base * 0.6));
    const nf = fitRowsUniform(spec.topics.map((t) => t.name), { width: avail, size: base, min: floor, hardMin: Math.round(Math.max(30, theme.type.caption)), maxRows: 2, meter: nm });
    const nameSize = Math.floor(nf.size);
    const baseLine = Math.max(26, Math.min(lineBase * sc, nameSize * 0.55));
    const lf = fitRowsUniform(spec.topics.map((t) => t.line), { width: avail, size: baseLine, min: 26, maxRows: 2, meter: lm, ellipsis: true });
    const lineSize = lf.size;
    const nameRowsN = Math.max(...nf.rows.map((r) => r.length));
    const lineRowsN = Math.max(...lf.rows.map((r) => r.length));
    const nameH = Math.round(nameSize * 1.1);
    const lineH = Math.round(lineSize * 1.2);
    const blockH = nameH * nameRowsN + ROW_GAP.a + lineH * lineRowsN + ROW_GAP.b + ROW_GAP.bar;
    const textW = Math.max(widest(nf.rows, nameSize, nm), widest(lf.rows, lineSize, lm));
    return { numSize, numW, nameSize, nameRows: nf.rows, nameRowsN, lineSize, lineRows: lf.rows, lineRowsN, nameH, lineH, blockH, textW };
  };
  let sc = 1;
  let b = build(sc);
  // el alto de la fila no pasa de lo que da el área segura dividida por los temas; si el bloque no entra, se achica todo parejo hasta el piso legible
  const scMin = Math.min(1, 52 / nameBase);
  for (let k = 0; k < 40 && b.blockH + 22 > H / n && sc > scMin; k++) {
    sc = Math.max(scMin, sc * Math.min(0.97, Math.max(0.5, (H / n - 22) / b.blockH)));
    b = build(sc);
  }
  // con la letra ya en el piso y sin entrar: casi todo el alto del cuadro (más vale pasar el área segura que cortar un nombre)
  const Hrow = b.blockH + 22 > H / n ? Math.max(H, height - 2 * Math.round(height * 0.03)) : H;
  const rowH = Math.floor(Math.min(b.blockH + 22, Hrow / n));
  const blockTop = Math.floor((rowH - b.blockH) / 2);
  const top = Math.round((height - n * rowH) / 2);
  const rowW = Math.round(Math.min(region, Math.max(b.numW + b.textW, region * 0.78)));
  const left = Math.round((width - rowW) / 2);
  const barW = rowW - b.numW;
  return {
    left, top, rowW, rowH, nameSize: b.nameSize, lineSize: b.lineSize, numSize: b.numSize, numW: b.numW, nameH: b.nameH, lineH: b.lineH, blockTop, blockH: b.blockH, barW,
    names: b.nameRows.map((r) => r.join(" ")), lines: b.lineRows.map((r) => r.join(" ")),
    target: (i) => ({ x: left + b.numW + Math.round(barW * 0.35), y: top + i * rowH + blockTop + b.nameH / 2 }),
    stacked: false, numH: b.nameH, numGap: 0, lineRows: b.lineRows, nameRows: b.nameRows, textW: Math.round(b.textW),
    barTop: blockTop + b.nameH * b.nameRowsN + ROW_GAP.a + b.lineH * b.lineRowsN + ROW_GAP.b, barLeft: b.numW,
  };
}

/** Separador entre el nombre y la línea de una fila en un renglón. */
export const INLINE_SEP = "·";

/**
 * Lista en un renglón por tema (`design.list: "inline"`, formatos anchos): `01 Nombre · línea`. El nombre va en negrita grande y la línea
 * más chica y atenuada, en la misma línea de base. Todo cabe en el ancho seguro: primero se achican los dos (la línea hasta el 70 % del
 * nombre) y, si aun así no entra, se corta la línea con "…". Las filas son más bajas que las apiladas y la lista queda centrada.
 */
function inlineLayout(spec: StorySpec, theme: Theme, width: number, height: number): Omit<ListLayout, "barWs"> {
  const n = spec.topics.length;
  const region = Math.max(600, width - 2 * theme.safe.x);
  const H = Math.max(300, height - 2 * theme.safe.y - 20);
  const nameBase = theme.type.h1 * 0.8;
  const rowH = Math.floor(Math.min(nameBase * 1.1 + ROW_GAP.b + ROW_GAP.bar + 70, H / n));
  const sc = Math.min(1, (rowH - 40) / (nameBase * 1.1 + ROW_GAP.b + ROW_GAP.bar));
  const base = nameBase * sc;
  const numSize = Math.max(26, Math.round(base * 0.6));
  const numW = Math.round(Math.max(base * 1.45, numSize * 2.2));
  const avail = region - numW;
  const sepW = (size: number) => textWidth(` ${INLINE_SEP} `, size, AVG_REG);
  // un solo tamaño de nombre para todas: el que necesita el par más largo con la línea al 70 % del nombre
  const ratio = 0.7;
  const need = (t: { name: string; line: string }, size: number) => textWidth(t.name, size, AVG_BOLD) + sepW(size * ratio) + textWidth(t.line, size * ratio, AVG_REG);
  const floor = Math.min(base, Math.max(40, base * 0.6));
  let nameSize = base;
  for (const t of spec.topics) {
    const w = need(t, base);
    if (w > avail) nameSize = Math.min(nameSize, base * (avail / w));
  }
  nameSize = Math.round(Math.max(floor, nameSize));
  const lineSize = Math.round(Math.max(24, nameSize * ratio));
  const names = spec.topics.map((t) => fitText(t.name, avail - sepW(lineSize) - lineSize * 3, nameSize, { min: nameSize }).text);
  const lines = spec.topics.map((t, i) => fitText(t.line, Math.max(120, avail - textWidth(names[i]!, nameSize, AVG_BOLD) - sepW(lineSize)), lineSize, { min: lineSize, avg: AVG_REG }).text);
  const nameH = Math.round(nameSize * 1.1);
  const blockH = nameH + ROW_GAP.b + ROW_GAP.bar;
  const blockTop = Math.floor((rowH - blockH) / 2);
  const top = Math.round((height - n * rowH) / 2);
  const rowText = Math.max(...names.map((s, i) => textWidth(s, nameSize, AVG_BOLD) + sepW(lineSize) + textWidth(lines[i]!, lineSize, AVG_REG)));
  const rowW = Math.round(Math.min(region, Math.max(numW + rowText, region * 0.78)));
  const left = Math.round((width - rowW) / 2);
  return {
    left, top, rowW, rowH, nameSize, lineSize, numSize, numW, nameH, lineH: nameH, blockTop, blockH, barW: rowW - numW, names, lines,
    // el atravesado apunta al medio del texto de la fila (no a su borde izquierdo): así el texto se abre parejo a los dos lados y no se corre hacia el borde derecho al empezar el zoom
    target: (i) => ({ x: left + numW + Math.round((rowW - numW) * 0.35), y: top + i * rowH + blockTop + nameH / 2 }),
    stacked: false, numH: nameH, numGap: 0, lineRows: [], barTop: blockTop + nameH + ROW_GAP.b, barLeft: numW, inline: true,
  };
}

/**
 * Lista de titulares: es lo más grande de la pantalla. Nombre ~0.8 × h1 y línea ~0.9 × body con filas de ~170 px hasta
 * 4 temas; con 5 o 6 todo se escala parejo (el nombre nunca baja de ~44 px). Todo en enteros: las posiciones
 * fraccionarias de capas compuestas se rasterizan según el historial de cuadros.
 */
export function listLayout(spec: StorySpec, theme: Theme, width: number, height: number): ListLayout {
  const L = baseLayout(spec, theme, width, height);
  const byName = listOptions(spec.design).underline === "name";
  if (L.nameRows) { // formatos angostos: el subrayado "name" llega hasta el renglón más ancho del nombre (medido)
    const nm = nameMeter(theme);
    return { ...L, barWs: L.nameRows.map((rows) => (byName ? Math.max(24, Math.min(L.barW, Math.round(widest([rows], L.nameSize, nm)))) : L.barW)) };
  }
  return { ...L, barWs: L.names.map((nm) => (byName ? Math.max(24, Math.min(L.barW, Math.round(textWidth(nm, L.nameSize, AVG_BOLD)))) : L.barW)) };
}

function baseLayout(spec: StorySpec, theme: Theme, width: number, height: number): Omit<ListLayout, "barWs"> {
  if (height / width > 1.3) return stackedLayout(spec, theme, width, height);
  if (isNarrow(width, height)) return columnLayout(spec, theme, width, height);
  // formato ancho: la lista de siempre; solo si esa lista cortaría con "…" un nombre o una bajada (más de lo que entra con la estimación y la letra mínima)
  // se arma en columna con el texto medido y partido en renglones (`columnLayout`). Mientras nada se corte, el marcado y los píxeles son los de siempre.
  const wide = listOptions(spec.design).layout === "inline" && width / height >= 1.3 ? inlineLayout(spec, theme, width, height) : wideLayout(spec, theme, width, height);
  const cuts = wide.names.some((nm, i) => nm !== spec.topics[i]!.name) || wide.lines.some((ln, i) => ln !== spec.topics[i]!.line);
  return cuts ? columnLayout(spec, theme, width, height) : wide;
}

function wideLayout(spec: StorySpec, theme: Theme, width: number, height: number): Omit<ListLayout, "barWs"> {
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
    // el atravesado apunta al medio del texto de la fila (no a su borde izquierdo): así el texto se abre parejo a los dos lados y no se corre hacia el borde derecho al empezar el zoom
    target: (i) => ({ x: left + numW + Math.round(barW * 0.35), y: top + i * rowH + blockTop + nameH / 2 }),
    stacked: false, numH: nameH, numGap: 0, lineRows: [], barTop: blockTop + nameH + ROW_GAP.a + lineH + ROW_GAP.b, barLeft: numW,
  };
}

// ---------------------------------------------------------------- muro de etiquetas

export type WallChip = { x: number; y: number; text: string };

/** Formato alto: el muro de la apertura es más denso y con piezas más grandes. */
export const isTall = (width: number, height: number) => height / width > 1.3;

/**
 * Muro de la apertura: `columns` × `rows` piezas (6 × 6 en horizontal, 3 × 12 en vertical por defecto, `spec.design.wall`) en ladrillo;
 * el azar solo mueve un poco cada pieza y le da su profundidad. Con los valores por defecto el reparto es el de siempre.
 * `design.wall.gapX` y `gapY` estiran o aprietan la grilla (multiplicadores de la separación; gapY escala desde el centro del cuadro), `brick` el
 * corrimiento de las filas alternas (0 = columnas alineadas) y `jitter` el temblor de cada pieza (0 = ninguno; el azar es `random("x" + i)`: sembrado y determinista).
 */
export function openingWall(spec: StorySpec, height = 1080, width = 1920): (WallChip & { z: number; on: number; k: number })[] {
  const fallback = spec.topics.map((t) => t.name);
  // En formatos altos las filas se separan más (el muro llena el alto); el ancho se corta solo (las piezas de afuera no se ven).
  const ky = height / 1080 > 1.2 ? height / 1080 : 1;
  const out: (WallChip & { z: number; on: number; k: number })[] = [];
  const tall = isTall(width, height);
  const w = spec.design?.wall;
  const { chipScale, depth, gapX, gapY, brick, jitter } = wallOptions(spec.design);
  const cols = w?.columns ?? (tall ? 3 : 6);
  const rows = w?.rows ?? (tall ? 12 : 6);
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (tall) {
      // piezas a escala 1,15 que cubren el alto del cuadro (3 columnas separadas 410 px y 12 filas, por defecto)
      out.push({
        text: labelAt(spec.labels, i, fallback),
        x: Math.round((col - (cols - 1) / 2) * (1230 / cols) * gapX + (row % 2 ? 100 : -100) * brick + (random(`x${i}`) - 0.5) * 30 * jitter),
        y: Math.round((row - (rows - 1) / 2) * ((height / 12.2) * (12 / rows)) * gapY + (random(`y${i}`) - 0.5) * 20 * jitter),
        z: Math.round((-250 + random(`z${i}`) * 360) * depth),
        on: 10 + random(`on${i}`) * 60,
        k: Math.round(1.15 * chipScale * 1000) / 1000,
      });
      continue;
    }
    out.push({
      text: labelAt(spec.labels, i, fallback),
      x: Math.round((col - (cols - 1) / 2) * (2400 / cols) * gapX + ((row % 2) * 200 - 100) * brick + (random(`x${i}`) - 0.5) * 40 * jitter),
      y: Math.round((-420 + row * (840 / (rows - 1))) * ky * gapY + (random(`y${i}`) - 0.5) * 24 * jitter),
      z: Math.round((-300 + random(`z${i}`) * 440) * depth),
      on: 10 + random(`on${i}`) * 60,
      k: chipScale,
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
 * píldora, bordes incluidos): se achica la letra hasta `PILL_MIN * caption`, para que dos píldoras vecinas no se pisen. Si el nombre no entra en un
 * renglón ni así, se mide de verdad y se parte en dos renglones con esa letra mínima (después, tres con letra aún menor): **un nombre nunca se corta con "…"**.
 * Cuando el nombre entra con la estimación de siempre, el resultado es el de siempre (un renglón, las mismas medidas).
 */
export function pillFit(theme: Theme, name: string, maxW?: number): { text: string; size: number; numSize: number; w: number; h: number; /** Renglones del nombre (uno casi siempre; dos o tres solo si no entra en uno ni con la letra mínima). */ rows: string[] } {
  const base = theme.type.caption * 1.06;
  const over = (size: number) => 2 * size * 0.9 + 6 + 16 + Math.max(26, size * 0.8) * 0.56 * 2;
  const minSize = maxW === undefined ? theme.type.caption * 0.8 : theme.type.caption * PILL_MIN;
  const t = maxW === undefined ? fitText(name, 560, base, { min: minSize }) : fitText(name, Math.max(60, maxW - over(base)), base, { min: minSize });
  if (t.text === name) {
    // entra en un renglón (con la estimación de siempre): la píldora de siempre
    return { text: t.text, size: t.size, numSize: Math.max(26, t.size * 0.8), w: Math.round(textWidth(t.text, t.size) + over(t.size)), h: Math.round(t.size * 1.25 + 2 * t.size * 0.42 + 6), rows: [t.text] };
  }
  // No entra con la estimación: se mide de verdad. Primero un renglón (con la letra bajando hasta el mínimo); si no, dos renglones con la letra mínima
  // (la píldora crece en alto, que es lo que la banda de arriba del panel admite) y, solo si ni así, se sigue achicando. Un nombre nunca se corta con "…".
  const meter = nameMeter(theme);
  const budget = maxW ?? 560 + over(base);
  const width = (s: number) => Math.max(60, budget - over(s));
  const rowsAt = (s: number) => wrapMeasured(name, width(s), s, meter);
  const ok = (r: string[], s: number) => r.every((x) => meter(x, s) <= width(s));
  const hardMin = Math.floor(theme.type.caption * 0.6);
  let size = Math.floor(minSize);
  let rows: string[] | null = null;
  for (let s = Math.floor(base); s >= Math.floor(minSize) && !rows; s--) { const r = rowsAt(s); if (r.length === 1 && ok(r, s)) { size = s; rows = r; } }
  for (let s = Math.floor(minSize); s >= hardMin && !rows; s--) { const r = rowsAt(s); if (r.length <= 2 && ok(r, s)) { size = s; rows = r; } }
  for (let s = hardMin; s >= Math.floor(hardMin * 0.8) && !rows; s--) { const r = rowsAt(s); if (r.length <= 3 && ok(r, s)) { size = s; rows = r; } }
  if (!rows) { size = Math.floor(hardMin * 0.8); rows = rowsAt(size); }
  const textW = Math.max(...rows.map((r) => meter(r, size)));
  return { text: rows.join(" "), size, numSize: Math.max(26, size * 0.8), w: Math.round(textW + over(size)), h: Math.round(size * 1.25 * rows.length + 2 * size * 0.42 + 6), rows };
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

/** Perspectiva de los paneles del cierre (px) y lo que se aleja cada uno del cuadro al entrar (px de profundidad, como máximo). */
const CARD_PERSP = 2200;
const ENTRY_LIFT = 260;

/**
 * Cuánta profundidad extra (px, hacia la cámara) puede tener el panel `c` al empezar a entrar sin que su píldora, ya agrandada por la
 * perspectiva y el zoom inicial de la cámara (1,1), se salga del cuadro (64 px de holgura por la inclinación). Hasta `ENTRY_LIFT`:
 * en horizontal queda entero; en vertical, donde los paneles llenan el alto, es menor.
 */
export function panelEntryLift(c: PanelPlace, theme: Theme, name: string, maxW: number | undefined, width: number, height: number, camStart = CLOSING_CAM_MAX): number {
  const cx = width / 2, cy = height / 2;
  const { panel, pill } = panelRects(c, theme, name, maxW);
  const reach = Math.max(cy - pill.y, panel.y + panel.h - cy, Math.abs(c.x - cx) + Math.max(pill.w * 1.12, panel.w) / 2); // 12 % de más en la píldora: el ancho del texto es una estimación (nombres anchos, mayúsculas)
  const room = Math.min(cy, cx) - 64;
  const factor = room / reach / camStart; // factor de perspectiva máximo que se tolera
  if (factor <= 1) return 0;
  const z = CARD_PERSP * (1 - 1 / factor);
  return Math.round(Math.max(0, Math.min(ENTRY_LIFT, z - c.z)));
}

/**
 * Zoom con el que arranca la cámara del cierre: 1,1 como máximo, y menos si con ese zoom la píldora de algún panel (con 12 % de margen
 * por la estimación del ancho del texto) o el panel mismo se saldrían del cuadro (40 px de holgura por la inclinación). En vertical la
 * píldora de arriba queda cerca del borde superior y con 1,1 asomaba unos px afuera.
 */
export function closingCamStart(panels: PanelPlace[], theme: Theme, names: string[], width: number, height: number): number {
  const cx = width / 2, cy = height / 2, slack = 40;
  let s = CLOSING_CAM_MAX;
  panels.forEach((c, i) => {
    const { panel, pill } = panelRects(c, theme, names[i] ?? "", pillBudget(panels, i, width));
    const reachY = Math.max(cy - pill.y, panel.y + panel.h - cy);
    const reachX = Math.abs(c.x - cx) + Math.max(pill.w * 1.12, panel.w) / 2;
    s = Math.min(s, (cy - slack) / reachY, (cx - slack) / reachX);
  });
  return Math.max(0.5, Math.floor(s * 1000) / 1000);
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
  const gapX = 36;
  const availW = width - 2 * 64;
  const top = PILL_BAND + 28, availH = height - top - 56;
  // una o dos columnas: se elige la que da los paneles más grandes (en vertical, con pocos temas, una columna; con cuatro o más y en cuadrado, dos)
  const fitK = (cols: number) => Math.min(1.75, (availW - (cols - 1) * gapX) / (cols * PANEL_W), (availH - (Math.ceil(n / cols) - 1) * ROW_GAP_Y) / (Math.ceil(n / cols) * PANEL_H));
  const cols = fitK(2) > fitK(1) + 1e-9 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const k = fitK(cols);
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

// ---------------------------------------------------------------- título de la apertura (formatos angostos)

/** Piso legible del título (relativo a `type.hero`) y piso de emergencia con el que, como último recurso, el título entra sin cortarse con "…". */
export const TITLE_FLOOR = 0.45;
export const TITLE_HARD_FLOOR = 0.3;
/** Renglones del título en formatos angostos antes de bajar la letra. */
export const TITLE_ROWS = 3;

export type TitleFit = { text: string; size: number; rows: string[]; /** `true` si entra en `TITLE_ROWS` renglones sin bajar de `TITLE_FLOOR × hero`. */ ok: boolean };

/** Ancho máximo del cartel del título (px) en un cuadro de ancho `width`. */
export const titleCardMax = (theme: Theme, width: number) => Math.min(1700, width - theme.safe.x);

/**
 * Acomoda el título de la apertura en un formato angosto midiéndolo con la tipografía del tema: primero hasta `TITLE_ROWS` renglones a `type.hero`, después una letra más
 * chica (hasta `TITLE_FLOOR × hero`); si ni así entra, sigue bajando hasta `TITLE_HARD_FLOOR` (con un renglón más) y `ok` queda en `false`. **Nunca corta con "…"**.
 * El cartel tiene un relleno de `0,55 × letra` por lado (ver `Opening`), que se descuenta del ancho.
 */
export function fitTitleNarrow(theme: Theme, text: string, width: number): TitleFit {
  const meter = nameMeter(theme);
  const maxW = titleCardMax(theme, width);
  const room = (s: number) => maxW - 2 * Math.round(s * 0.55) - 8;
  const rowsAt = (s: number) => wrapMeasured(text, room(s), s, meter);
  const fits = (r: string[], s: number, max: number) => r.length <= max && r.every((x) => meter(x, s) <= room(s));
  const hero = theme.type.hero;
  const floor = Math.round(hero * TITLE_FLOOR), hard = Math.round(hero * TITLE_HARD_FLOOR);
  for (let s = Math.round(hero); s >= floor; s--) { const r = rowsAt(s); if (fits(r, s, TITLE_ROWS)) return { text, size: s, rows: r, ok: true }; }
  for (let s = floor - 1; s >= hard; s--) { const r = rowsAt(s); if (fits(r, s, TITLE_ROWS + 1)) return { text, size: s, rows: r, ok: false }; }
  return { text, size: hard, rows: rowsAt(hard), ok: false };
}

// ---------------------------------------------------------------- miniatura de la revelación (formatos angostos)

export type RevealThumb = {
  /** `"free"`: hay un lugar libre al costado del texto (a la derecha, sin pisarlo). `"spotlight"`: no lo hay; la lista se aparta un momento y la miniatura se muestra en el centro. */
  mode: "free" | "spotlight";
  /** Centro (px del cuadro) y tamaño de la miniatura en reposo. */
  x: number; y: number; w: number; h: number;
};

/** Ancho mínimo y máximo de la miniatura de la revelación, como parte del ancho del cuadro. */
export const REVEAL_THUMB = { min: 0.3, max: 0.42, spotlight: 0.42 };

type TextRect = { x: number; y: number; w: number; h: number };

/** Cajas de todo el texto de la lista (número, nombre, bajada y, en la fila `lateI`, el subrayado), medidas con la tipografía del tema. */
export function listTextRects(L: ListLayout, theme: Theme, lateI = -1, lift = 0): TextRect[] {
  const nm = nameMeter(theme), lm = lineMeter(theme);
  const out: TextRect[] = [];
  const n = L.names.length;
  for (let i = 0; i < n; i++) {
    const rowTop = L.top + i * L.rowH - (i === lateI ? 0 : lift); // `lift`: lo que las filas ya vistas suben en la revelación escenificada
    const nameRows = L.nameRows?.[i] ?? [L.names[i]!];
    const lineRows = L.lineRows[i] ?? [L.lines[i]!];
    const x0 = L.stacked ? L.left : L.left + L.numW;
    const nameTop = rowTop + L.blockTop + (L.stacked ? L.numH + L.numGap : 0);
    if (L.stacked) out.push({ x: L.left - 6, y: rowTop + L.blockTop, w: Math.round(L.numSize * 1.7), h: L.numH });
    else out.push({ x: L.left, y: nameTop, w: L.numW, h: L.nameH });
    nameRows.forEach((r, k) => out.push({ x: x0, y: nameTop + k * L.nameH, w: nm(r, L.nameSize), h: L.nameH }));
    const lineTop = nameTop + nameRows.length * L.nameH + ROW_GAP.a;
    lineRows.forEach((r, k) => out.push({ x: x0, y: lineTop + k * L.lineH, w: lm(r, L.lineSize), h: L.lineH }));
    if (i === lateI) out.push({ x: L.left + L.barLeft, y: rowTop + L.barTop, w: L.barWs[i] ?? L.barW, h: ROW_GAP.bar });
  }
  return out;
}

/**
 * Dónde va la miniatura de la tarjeta que se revela (`design.reveal: "stage"`) en un formato angosto. Se busca, contra las cajas medidas de todo el texto de la lista,
 * el lugar más grande (de `REVEAL_THUMB.max` a `REVEAL_THUMB.min` del ancho del cuadro) pegado al borde derecho de la lista, dentro del cuadro y sin tocar ningún
 * texto (14 px de aire), lo más cerca posible del renglón de la fila nueva. Si no hay ninguno (cuadrado con la lista llena), vuelve `"spotlight"`: la miniatura en el centro.
 */
export function revealThumbRect(L: ListLayout, theme: Theme, lateI: number, width: number, height: number): RevealThumb {
  const rects = listTextRects(L, theme, lateI, L.rowH * 0.14); // las filas ya vistas se corren 0,14 filas hacia arriba (Interlude: `room`)
  const air = 14;
  const hit = (a: TextRect, b: TextRect) => a.x < b.x + b.w + air && a.x + a.w + air > b.x && a.y < b.y + b.h + air && a.y + a.h + air > b.y;
  const right = Math.min(L.left + L.rowW, width - Math.round(width * 0.06));
  const yMin = Math.round(height * 0.06), yMax = height - Math.round(height * 0.06);
  const prefer = L.top + lateI * L.rowH + L.blockTop + (L.stacked ? L.numH + L.numGap + L.nameH / 2 : L.nameH / 2);
  for (let w = Math.round(width * REVEAL_THUMB.max); w >= Math.round(width * REVEAL_THUMB.min); w -= 4) {
    const h = Math.round((w * 340) / 560);
    let best: { y: number; d: number } | null = null;
    for (let top = yMin; top + h <= yMax; top += 4) {
      const box = { x: right - w, y: top, w, h };
      if (rects.some((r) => hit(box, r))) continue;
      const d = Math.abs(top + h / 2 - prefer);
      if (!best || d < best.d) best = { y: top, d };
    }
    if (best) return { mode: "free", x: right - w / 2, y: best.y + h / 2, w, h };
  }
  const w = Math.round(width * REVEAL_THUMB.spotlight);
  return { mode: "spotlight", x: width / 2, y: height / 2, w, h: Math.round((w * 340) / 560) };
}
