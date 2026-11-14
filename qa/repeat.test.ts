import { describe, expect, it } from 'vitest';
import { canonicalReport, diffReports } from './repeat';
import type { QaResult } from './run';
import { emptyJudged } from './rules';
import type { Finding } from './types';

const el = (text: string) => ({ tag: 'span', testid: null, text, rect: { x: 0, y: 0, w: 1, h: 1 } });
const f = (frame: number, text: string, ratio: number): Finding => ({ rule: 'contrast', severity: 'error', frame, message: `contraste ${ratio}:1`, element: el(text), data: { ratio } });
const res = (findings: Finding[], seconds = 1): QaResult => ({ findings, summary: { videoId: 'v', frames: [0], total: findings.length, errors: findings.length, warnings: 0, infos: 0, byRule: { contrast: findings.length }, judged: emptyJudged(), seconds } });

describe('diffReports', () => {
  it('ignora el tiempo', () => {
    expect(diffReports(res([f(1, 'a', 2)], 1), res([f(1, 'a', 2)], 9))).toEqual([]);
    expect(canonicalReport(res([], 1))).toBe(canonicalReport(res([], 7)));
  });
  it('detecta un hallazgo que aparece o desaparece', () => {
    expect(diffReports(res([f(1, 'a', 2)]), res([]))).toEqual([expect.stringContaining('solo en la primera corrida')]);
    expect(diffReports(res([]), res([f(1, 'a', 2)]))).toEqual([expect.stringContaining('solo en la otra corrida')]);
  });
  it('detecta una medida que cambia en el mismo hallazgo', () => {
    const d = diffReports(res([f(1, 'a', 2.4)]), res([f(1, 'a', 2.6)]));
    expect(d).toHaveLength(1);
    expect(d[0]).toContain('cambia la medida');
  });
});
