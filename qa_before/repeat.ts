// Autocomprobación de reproducibilidad: `ve-qa --repeat N` corre el mismo control N veces y compara los informes.
// El control tiene que ser una función determinista del video y de las opciones: si dos corridas difieren, es un defecto del propio qa.
import type { Finding } from './types';
import type { QaResult } from './run';

/** Identidad de un hallazgo: cuadro, regla, severidad y elementos. No incluye el mensaje ni las medidas (eso se compara aparte). */
const idOf = (f: Finding) => [f.frame, f.rule, f.severity, f.element.tag, f.element.testid ?? '', f.element.text, f.other?.tag ?? '', f.other?.testid ?? '', f.other?.text ?? ''].join('|');
const bodyOf = (f: Finding) => JSON.stringify({ message: f.message, data: f.data ?? null, element: f.element, other: f.other ?? null });

/** Informe sin los campos que dependen del reloj (`summary.seconds`), serializado de forma estable. */
export const canonicalReport = (r: QaResult): string => {
  const { seconds: _s, ...summary } = r.summary;
  return JSON.stringify({ findings: r.findings, summary });
};

/** Diferencias entre dos informes, una línea por hallazgo que aparece solo en uno o cuyas medidas/mensaje cambian. Vacío si son idénticos. */
export function diffReports(a: QaResult, b: QaResult): string[] {
  if (canonicalReport(a) === canonicalReport(b)) return [];
  const out: string[] = [];
  const index = (r: QaResult) => {
    const m = new Map<string, string[]>();
    for (const f of r.findings) (m.get(idOf(f)) ?? m.set(idOf(f), []).get(idOf(f))!).push(bodyOf(f));
    return m;
  };
  const ia = index(a), ib = index(b);
  for (const k of new Set([...ia.keys(), ...ib.keys()])) {
    const x = ia.get(k) ?? [], y = ib.get(k) ?? [];
    if (!x.length) out.push(`solo en la otra corrida: ${k}`);
    else if (!y.length) out.push(`solo en la primera corrida: ${k}`);
    else if (x.join('\n') !== y.join('\n')) out.push(`cambia la medida o el mensaje: ${k}\n    antes: ${x[0]}\n    ahora: ${y[0]}`);
  }
  if (!out.length) out.push('los hallazgos coinciden pero el resumen difiere (conteos, callados o adorno)');
  return out;
}
