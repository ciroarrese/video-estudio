// Modo multi-sistema: `ve-qa --themes neutral,dark,editorial,neon,papel` (o `all`) corre los MISMOS cuadros bajo cada design system
// (por `--props '{"theme":"<nombre>"}'`) y compara: una matriz errores/avisos por regla y sistema, y los hallazgos que aparecen en
// unos sistemas y en otros no (la maquetacion que asume las medidas o los colores de un solo tema).
import type { ElementInfo, Finding } from './types';
import type { QaResult } from './run';
import { runQa, type QaOptions } from './run';
import { formatElement } from './geometry';

/** Los design systems con nombre que el repo trae (themes/index.ts); `--themes all` los corre todos. */
export const THEME_NAMES = ['neutral', 'dark', 'editorial', 'neon', 'papel'] as const;

export function parseThemes(spec: string): string[] {
  const list = spec.trim() === 'all' ? [...THEME_NAMES] : spec.split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) throw new Error('--themes: lista vacia (usa neutral,dark,... o all)');
  for (const t of list) if (!(THEME_NAMES as readonly string[]).includes(t)) throw new Error(`--themes: sistema desconocido "${t}" (disponibles: ${THEME_NAMES.join(', ')}, o all)`);
  return [...new Set(list)];
}

export type Cell = { errors: number; warnings: number; byRule: Record<string, { error: number; warn: number }> };
export type Difference = {
  rule: string; frame: number; element: ElementInfo; other?: ElementInfo;
  /** Severidad (error o warn) en cada sistema donde aparece; los que no estan, no lo tienen (o lo tienen como info). */
  bySystem: Record<string, string>;
  present: string[]; absent: string[];
  /** Mensaje del primer sistema donde aparece. */
  message: string;
};
export type Matrix = { themes: string[]; rules: string[]; cells: Record<string, Cell>; differences: Difference[] };

const keyOf = (f: Finding) => [f.frame, f.rule, f.element.tag, f.element.testid ?? '', f.element.text, f.other?.tag ?? '', f.other?.testid ?? '', f.other?.text ?? ''].join('|');

/** Matriz y diferencias entre sistemas, a partir del informe de cada uno (solo errores y avisos: `info` es ruido de transicion). */
export function buildMatrix(results: Record<string, QaResult>): Matrix {
  const themes = Object.keys(results);
  const cells: Record<string, Cell> = {};
  const rules = new Set<string>();
  const seen = new Map<string, { f: Finding; bySystem: Record<string, string> }>();
  for (const t of themes) {
    const cell: Cell = { errors: 0, warnings: 0, byRule: {} };
    for (const f of results[t]!.findings) {
      if (f.severity === 'info') continue;
      rules.add(f.rule);
      const c = (cell.byRule[f.rule] ??= { error: 0, warn: 0 });
      if (f.severity === 'error') { cell.errors++; c.error++; } else { cell.warnings++; c.warn++; }
      const k = keyOf(f);
      const e = seen.get(k) ?? seen.set(k, { f, bySystem: {} }).get(k)!;
      const prev = e.bySystem[t];
      if (prev !== 'error') e.bySystem[t] = f.severity;
    }
    cells[t] = cell;
  }
  const differences: Difference[] = [];
  for (const { f, bySystem } of seen.values()) {
    const present = themes.filter((t) => bySystem[t]);
    const sevs = new Set(present.map((t) => bySystem[t]));
    if (present.length === themes.length && sevs.size === 1) continue;
    differences.push({ rule: f.rule, frame: f.frame, element: f.element, ...(f.other ? { other: f.other } : {}), bySystem, present, absent: themes.filter((t) => !bySystem[t]), message: f.message });
  }
  differences.sort((a, b) => a.frame - b.frame || a.rule.localeCompare(b.rule) || a.element.text.localeCompare(b.element.text));
  return { themes, rules: [...rules].sort(), cells, differences };
}

/** Texto de la matriz: una fila por regla, una columna por sistema (`errores/avisos`), y el total. */
export function formatMatrix(m: Matrix): string {
  const w = Math.max(10, ...m.themes.map((t) => t.length + 1));
  const lines = [`${'regla'.padEnd(12)}${m.themes.map((t) => t.padStart(w)).join('')}`];
  for (const r of m.rules) lines.push(`${r.padEnd(12)}${m.themes.map((t) => { const c = m.cells[t]!.byRule[r]; return (c ? `${c.error}/${c.warn}` : '-').padStart(w); }).join('')}`);
  lines.push(`${'TOTAL'.padEnd(12)}${m.themes.map((t) => `${m.cells[t]!.errors}/${m.cells[t]!.warnings}`.padStart(w)).join('')}`);
  return `errores/avisos por regla y sistema (- = nada)\n${lines.join('\n')}`;
}

export function formatDifferences(m: Matrix, max = 40): string {
  if (!m.differences.length) return 'diferencias entre sistemas: ninguna (los mismos errores y avisos en todos)';
  const out = [`diferencias entre sistemas: ${m.differences.length} hallazgos que no estan (o cambian de severidad) en todos`];
  m.differences.slice(0, max).forEach((d) => {
    out.push(`  ${d.rule} cuadro ${d.frame} ${formatElement(d.element)}${d.other ? ` | con ${formatElement(d.other)}` : ''}: ${d.present.map((t) => `${t} (${d.bySystem[t]})`).join(', ')}; no en ${d.absent.join(', ') || '(ninguno)'}\n      ${d.message}`);
  });
  if (m.differences.length > max) out.push(`  … ${m.differences.length - max} más (--max N)`);
  return out.join('\n');
}

/** Corre el mismo control bajo cada sistema, uno por vez (un navegador a la vez: la maquina se comparte). */
export async function runQaThemes(o: QaOptions, themes: string[]): Promise<Record<string, QaResult>> {
  const out: Record<string, QaResult> = {};
  for (const t of themes) out[t] = await runQa({ ...o, props: { ...(o.props ?? {}), theme: t } });
  return out;
}
