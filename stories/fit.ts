import { deriveFormatSizes } from "../engine";
import type { FormatName } from "../engine";
import type { Theme } from "../themes";
import { fitText, fitTitleNarrow, listLayout, listTextRects } from "./layout";
import { resolveStorySpec } from "./shared";
import { withoutLate } from "./types";
import type { StorySpec } from "./types";

/**
 * Validación medida de los largos de una historia (sin DOM, con lo que ya usa `stories/layout.ts`): dado un `spec`, un tema y un formato, dice si la lista de
 * temas y el título de la apertura entran en el área segura sin bajar del piso legible y, si no, qué nombre o bajada acortar y a cuántos caracteres aproximados.
 *
 * Es una función pura: no toca el render. La usan `defineStory` (aviso al componer, una sola vez por formato) y `qa` (regla `story-fit`).
 * Mide con la tipografía del tema (`kit/textWidth`): en el navegador es la medida real; en Node/jsdom (pruebas) es una estimación por glifo, algo más ancha o más angosta que la fuente.
 */

/** Margen del área segura por lado, como parte del cuadro: el mismo de la regla `safe-area` de `qa` (3 %). */
export const FIT_MARGIN = 0.03;
/** Pisos legibles (px a 1080 de lado corto): letra del nombre y de la bajada. Por debajo, la lista "entra" pero no se lee. */
export const NAME_FLOOR = 44;
export const LINE_FLOOR = 26;
/** Renglones máximos del nombre y de la bajada en la lista (un tercer renglón del nombre es el último recurso del diseño: no se considera legible). */
export const MAX_NAME_ROWS = 2;
/** Largo mínimo al que se propone acortar (con menos no tiene sentido seguir: sobran temas o hay que cambiar el diseño). */
const MIN_CHARS = 8;

export type FitIssueKind = "name" | "line" | "title" | "list";
export type FitIssue = {
  kind: FitIssueKind;
  /** Índice y id del tema (solo en `name` y `line`). */
  topic?: number;
  id?: string;
  /** Largo actual y largo aproximado al que acortar (caracteres). */
  chars?: number;
  maxChars?: number;
  /** Mensaje accionable en español. */
  message: string;
};

export type FitReport = {
  format: string;
  width: number;
  height: number;
  ok: boolean;
  /** Qué falla, en una línea por causa (la lista se pasa del área segura, la letra baja del piso, un renglón sobra, el título se corta). */
  causes: string[];
  /** Qué acortar: una entrada por nombre, bajada o título que supera el largo propuesto. */
  issues: FitIssue[];
  /** Largo propuesto para nombres y bajadas (todos los que lo superan van en `issues`); `undefined` si no hace falta o no alcanza con acortar. */
  suggest?: { name?: number; line?: number; title?: number };
  /** Cómo quedó la lista tal cual está (tamaños de letra, renglones y cuánto se pasa del área segura, en px). */
  list: { nameSize: number; lineSize: number; nameRows: number; overflowPx: number };
  /** Cómo quedó el título de la apertura. */
  title: { size: number; rows: number; ok: boolean };
};

type FormatArg = FormatName | { width: number; height: number };

const base = { width: 1920, height: 1080 };
/** Tamaño de un formato: el nombre se deriva del tamaño base de la historia (1920 x 1080 por defecto). */
export function fitSize(format: FormatArg, from: { width: number; height: number } = base): { name: string; width: number; height: number } {
  if (typeof format === "object") return { name: `${format.width}x${format.height}`, ...format };
  return { name: format, ...deriveFormatSizes(from.width, from.height)[format] };
}

type Probe = { causes: string[]; list: FitReport["list"]; title: FitReport["title"] };

/** Mide un `spec` en un tamaño: devuelve las causas por las que no entra (vacío si entra) y las medidas. */
function probe(spec: StorySpec, theme: Theme, width: number, height: number): Probe {
  const L = listLayout(resolveStorySpec(theme, spec, width, height), theme, width, height);
  const causes: string[] = [];
  const rects = listTextRects(L, theme, -1);
  const mx = width * FIT_MARGIN, my = height * FIT_MARGIN;
  const top = Math.min(...rects.map((r) => r.y)), bottom = Math.max(...rects.map((r) => r.y + r.h));
  const left = Math.min(...rects.map((r) => r.x)), right = Math.max(...rects.map((r) => r.x + r.w));
  const overflowPx = Math.round(Math.max(0, my - top, bottom - (height - my), mx - left, right - (width - mx)));
  if (overflowPx > 1) causes.push(`la lista se pasa ${overflowPx} px del área segura`);
  const nameRows = Math.max(...(L.nameRows ?? L.names.map(() => [""])).map((r) => r.length));
  if (L.nameSize < NAME_FLOOR) causes.push(`la letra de los nombres baja a ${L.nameSize} px (el piso legible es ${NAME_FLOOR})`);
  if (nameRows > MAX_NAME_ROWS) causes.push(`algún nombre necesita ${nameRows} renglones (el máximo es ${MAX_NAME_ROWS})`);
  if (L.lineSize < LINE_FLOOR) causes.push(`la letra de las bajadas baja a ${L.lineSize} px (el piso legible es ${LINE_FLOOR})`);
  if (L.names.some((n, i) => n.replace(/\s+/g, " ") !== spec.topics[i]!.name.replace(/\s+/g, " "))) causes.push("un nombre se corta con \"…\"");
  if (L.lines.some((n, i) => n.replace(/\s+/g, " ") !== spec.topics[i]!.line.replace(/\s+/g, " "))) causes.push("una bajada se corta con \"…\"");
  // título de la apertura
  let title: FitReport["title"];
  if (width / height < 1.3) {
    const t = fitTitleNarrow(theme, spec.title.text, width);
    title = { size: t.size, rows: t.rows.length, ok: t.ok };
  } else {
    const t = fitText(spec.title.text, Math.min(1560, width - 2 * theme.safe.x), theme.type.hero, { min: theme.type.hero * 0.5, lines: 2, avg: 0.55 });
    title = { size: Math.round(t.size), rows: 2, ok: t.text === spec.title.text };
  }
  if (!title.ok) causes.push(`el título no entra en ${width / height < 1.3 ? 3 : 2} renglones sin bajar de ${Math.round(theme.type.hero * (width / height < 1.3 ? 0.45 : 0.5))} px (o se corta con "…")`);
  return { causes, list: { nameSize: L.nameSize, lineSize: L.lineSize, nameRows, overflowPx }, title };
}

/** Recorta un texto a `n` caracteres (a propósito sin buscar fin de palabra: es la medida de un texto de ese largo, que es lo que se le dice a quien escribe). */
function cap(text: string, n: number): string {
  return Array.from(text).slice(0, n).join("").trimEnd();
}

/** Mayor `c` en [lo, hi) con `good(c)`, suponiendo que si `c` sirve también sirve uno menor; `undefined` si ni `lo` sirve. */
function largest(lo: number, hi: number, good: (c: number) => boolean): number | undefined {
  if (hi <= lo || !good(lo)) return undefined;
  let a = lo, b = hi - 1;
  while (a < b) { const m = Math.ceil((a + b) / 2); if (good(m)) a = m; else b = m - 1; }
  return a;
}

/**
 * ¿La historia entra en este formato? Mide la lista de la apertura (sin el tema tardío) y la de la vuelta de revelación (con todos), y el título de la apertura.
 * `theme` es el design system (por defecto, el que use el video); `from` el tamaño base de la historia (1920 x 1080) del que se derivan vertical y cuadrado.
 */
export function checkStoryFit(spec: StorySpec, theme: Theme, format: FormatArg, from: { width: number; height: number } = base): FitReport {
  const size = fitSize(format, from);
  const { width, height } = size;
  const variants = (s: StorySpec) => [withoutLate(s), s].filter((v, i, a) => a.indexOf(v) === i);
  const run = (s: StorySpec): Probe[] => variants(s).map((v) => probe(v, theme, width, height));
  const first = run(spec);
  const causes = [...new Set(first.flatMap((p) => p.causes))];
  const worst = first.reduce((a, b) => (b.list.overflowPx > a.list.overflowPx ? b : a));
  const report: FitReport = { format: size.name, width, height, ok: causes.length === 0, causes, issues: [], list: worst.list, title: first[0]!.title };
  if (report.ok) return report;

  const listOk = (s: StorySpec) => run(s).every((p) => !p.causes.some((c) => !c.startsWith("el título")));
  const titleOk = (s: StorySpec) => run(s).every((p) => p.title.ok);
  const mapTopics = (n: number | undefined, l: number | undefined): StorySpec => ({
    ...spec,
    topics: spec.topics.map((t) => ({ ...t, name: n === undefined ? t.name : cap(t.name, n), line: l === undefined ? t.line : cap(t.line, l) })),
  });
  const maxN = Math.max(...spec.topics.map((t) => Array.from(t.name).length));
  const maxL = Math.max(...spec.topics.map((t) => Array.from(t.line).length));
  const suggest: NonNullable<FitReport["suggest"]> = {};
  if (!listOk(spec)) {
    // 1) alcanza con acortar los nombres; 2) con las bajadas; 3) con las dos (la bajada con un 30 % más de caracteres que el nombre)
    const n1 = largest(MIN_CHARS, maxN, (c) => listOk(mapTopics(c, undefined)));
    if (n1 !== undefined) suggest.name = n1;
    else {
      const l1 = largest(MIN_CHARS, maxL, (c) => listOk(mapTopics(undefined, c)));
      if (l1 !== undefined) suggest.line = l1;
      else {
        const c2 = largest(MIN_CHARS, maxN, (c) => listOk(mapTopics(c, Math.round(c * 1.3))));
        if (c2 !== undefined) { suggest.name = c2; suggest.line = Math.round(c2 * 1.3); }
      }
    }
    const fmt = size.name;
    if (suggest.name === undefined && suggest.line === undefined) {
      report.issues.push({ kind: "list", message: `Formato ${fmt}: la lista de ${spec.topics.length} temas no entra ni con nombres de ${MIN_CHARS} caracteres: bajá la cantidad de temas o simplificá las bajadas.` });
    }
    spec.topics.forEach((t, i) => {
      const nameLen = Array.from(t.name).length, lineLen = Array.from(t.line).length;
      if (suggest.name !== undefined && nameLen > suggest.name) {
        report.issues.push({ kind: "name", topic: i, id: t.id, chars: nameLen, maxChars: suggest.name, message: `Formato ${fmt}: acortá el nombre del tema "${t.id}" de ${nameLen} a unos ${suggest.name} caracteres (${report.causes[0] ?? "la lista no entra"}).` });
      }
      if (suggest.line !== undefined && lineLen > suggest.line) {
        report.issues.push({ kind: "line", topic: i, id: t.id, chars: lineLen, maxChars: suggest.line, message: `Formato ${fmt}: acortá la bajada del tema "${t.id}" de ${lineLen} a unos ${suggest.line} caracteres (${report.causes[0] ?? "la lista no entra"}).` });
      }
    });
  }
  if (!titleOk(spec)) {
    const len = Array.from(spec.title.text).length;
    const c = largest(MIN_CHARS, len, (k) => titleOk({ ...spec, title: { ...spec.title, text: cap(spec.title.text, k) } }));
    if (c !== undefined) suggest.title = c;
    report.issues.push({ kind: "title", chars: len, maxChars: c, message: c !== undefined ? `Formato ${size.name}: acortá el título de ${len} a unos ${c} caracteres para que entre sin cortarse.` : `Formato ${size.name}: el título no entra en ${width / height < 1.3 ? 3 : 2} renglones; acortalo.` });
  }
  if (Object.keys(suggest).length) report.suggest = suggest;
  return report;
}

/** Una línea por problema, lista para imprimir (vacío si la historia entra). */
export function formatFitReport(r: FitReport): string[] {
  if (r.ok) return [];
  return r.issues.length ? r.issues.map((i) => i.message) : [`Formato ${r.format}: ${r.causes.join("; ")}.`];
}

// ---------------------------------------------------------------- registro para `qa`

type FitProbe = (format: string, themeName?: string) => FitReport | null;
const REGISTRY = "__veStoryFit";

/**
 * `defineStory` deja acá la verificación de cada historia (por id) para que `qa` la pida desde la página (`window.__veStoryFit[id](formato, tema)`).
 * Es solo una tabla de funciones puras: no cambia nada de lo que se dibuja.
 */
export function registerStoryFit(id: string, fn: FitProbe): void {
  const g = globalThis as unknown as Record<string, Record<string, FitProbe>>;
  (g[REGISTRY] ??= {})[id] = fn;
}

