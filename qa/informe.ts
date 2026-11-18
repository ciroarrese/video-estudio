import type { Finding } from './types';

export const RANK = { error: 2, warn: 1, info: 0 } as const;

/** "78–143" style: runs of consecutive sampled frames collapse into ranges. */
export function frameRanges(frames: number[], sampled: number[]): string {
  const order = new Map([...sampled].sort((x, y) => x - y).map((f, i) => [f, i]));
  const fs = [...new Set(frames)].sort((x, y) => x - y);
  const out: string[] = [];
  for (let i = 0; i < fs.length; ) {
    let j = i;
    while (j + 1 < fs.length && order.has(fs[j]!) && order.get(fs[j + 1]!) === order.get(fs[j]!)! + 1) j++;
    out.push(j > i ? `${fs[i]}\u2013${fs[j]}` : `${fs[i]}`);
    i = j + 1;
  }
  return out.join(', ');
}

/** One group per rule + element (+ partner element): worst severity wins, frames are merged. */
export function groupFindings(findings: Finding[]): { first: Finding; severity: Finding['severity']; frames: number[]; counts: Record<string, number> }[] {
  const groups = new Map<string, { first: Finding; severity: Finding['severity']; frames: number[]; counts: Record<string, number> }>();
  for (const f of findings) {
    const key = [f.rule, f.element.tag, f.element.testid, f.element.text, f.other?.text ?? ''].join('|');
    const g = groups.get(key);
    if (g) {
      g.frames.push(f.frame);
      g.counts[f.severity] = (g.counts[f.severity] ?? 0) + 1;
      if (RANK[f.severity] > RANK[g.severity]) { g.severity = f.severity; g.first = f; }
    } else groups.set(key, { first: f, severity: f.severity, frames: [f.frame], counts: { [f.severity]: 1 } });
  }
  return [...groups.values()];
}


/**
 * Donde se dice que aparece un grupo: los cuadros comprimidos en rangos (`78\u2013143, 260`) y, para `texto-chico`, la CUENTA de cuadros (`12 cuadros (78\u2013260)`):
 * una interfaz recreada tiene cientos de textos chicos y una lista de rangos por elemento tapaba lo que importa. Con un solo cuadro, el numero del cuadro.
 */
export function whereOf(rule: string, frames: number[], sampled: number[]): string {
  const uf = [...new Set(frames)].sort((a, b) => a - b);
  return rule === 'texto-chico' && uf.length > 1 ? `${uf.length} cuadros (${uf[0]}\u2013${uf[uf.length - 1]})` : frameRanges(frames, sampled);
}
