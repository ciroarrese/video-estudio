import { rectShift } from './geometry';
import type { PageData, Rect, TextRun } from './types';

/** Distinct element keys of the covers found in `data` (their motion has to be looked up in the neighbours). */
export const coverKeys = (data: PageData): string[] => [...new Set(data.runs.flatMap((r) => [...(r.cover ? [r.cover.key] : []), ...(r.veil ? [r.veil.key] : [])]))];

/** Clave sin el texto (ruta|etiqueta|testid#nodo) de un contador: `CountUp` cambia el texto en cada cuadro y la clave exacta no coincidiria nunca. */
export function looseKey(r: Pick<TextRun, 'key' | 'text'>): string | null {
  if (!/^[\d\s.,:%+\-$€]+$/.test(r.text)) return null;
  const [path, tag, testid] = r.key.split('|');
  return `${path}|${tag}|${testid}#${r.key.slice(r.key.lastIndexOf('#') + 1)}`;
}

/**
 * Sets `run.motion` / `run.fade` / `run.cover.motion` / `run.veil.fade`: the largest edge displacement (px) of the same element (same key)
 * between `data` and each neighbour frame. Elements missing in a neighbour count as 0: static defects stay errors.
 */
export function applyMotion(data: PageData, neighbours: PageData[]): void {
  const lookups = neighbours.map((n) => {
    const m = new Map<string, { rect: Rect; opacity: number }>();
    for (const r of n.runs) {
      m.set(r.key, { rect: r.rect, opacity: r.opacity });
      const lk = looseKey(r);
      if (lk && !m.has(lk)) m.set(lk, { rect: r.rect, opacity: r.opacity });
    }
    return { runs: m, elems: n.elems, opac: n.opac ?? {} };
  });
  for (const r of data.runs) {
    let mv = 0;
    let fade = 0;
    for (const l of lookups) {
      const o = l.runs.get(r.key) ?? (looseKey(r) ? l.runs.get(looseKey(r)!) : undefined);
      if (o) {
        mv = Math.max(mv, rectShift(r.rect, o.rect));
        if (Number.isFinite(o.opacity) && Number.isFinite(r.opacity)) fade = Math.max(fade, Math.abs(r.opacity - o.opacity));
      }
      if (r.cover) {
        const e = l.elems[r.cover.key];
        if (e) r.cover.motion = Math.max(r.cover.motion ?? 0, rectShift(r.cover.rect, e));
      }
    }
    if (r.veil) {
      let vf = 0;
      for (const l of lookups) vf = Math.max(vf, Math.abs(r.veil.opacity - (l.opac[r.veil.key] ?? 0)));
      r.veil.fade = vf;
    }
    r.motion = mv;
    r.fade = fade;
  }
}
