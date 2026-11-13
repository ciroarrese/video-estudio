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

/** Firma sin la ruta del DOM (etiqueta|testid|texto): empareja un texto cuya ruta cambió entre cuadros (p. ej. un hermano que se monta o se desmonta corre los índices). */
const sigOf = (r: Pick<TextRun, 'tag' | 'testid' | 'text'>) => `${r.tag}|${r.testid ?? ''}|${r.text}`;

/**
 * Sets `run.motion` / `run.fade` / `run.cover.motion` / `run.veil.fade`: the largest edge displacement (px) of the same element (same key)
 * between `data` and each neighbour frame. Elements missing in a neighbour count as 0: static defects stay errors.
 */
export function applyMotion(data: PageData, neighbours: PageData[]): void {
  const lookups = neighbours.map((n) => {
    const m = new Map<string, { rect: Rect; opacity: number }>();
    const sigs = new Map<string, { rect: Rect; opacity: number } | null>(); // null: la firma se repite en el vecino (no se usa)
    for (const r of n.runs) {
      const sg = sigOf(r);
      sigs.set(sg, sigs.has(sg) ? null : { rect: r.rect, opacity: r.opacity });
      m.set(r.key, { rect: r.rect, opacity: r.opacity });
      const lk = looseKey(r);
      if (lk && !m.has(lk)) m.set(lk, { rect: r.rect, opacity: r.opacity });
    }
    return { runs: m, sigs, elems: n.elems, opac: n.opac ?? {} };
  });
  const here = new Map<string, number>();
  for (const r of data.runs) here.set(sigOf(r), (here.get(sigOf(r)) ?? 0) + 1);
  for (const r of data.runs) {
    let mv = 0;
    let fade = 0;
    for (const l of lookups) {
      const o = l.runs.get(r.key) ?? (looseKey(r) ? l.runs.get(looseKey(r)!) : undefined) ?? (here.get(sigOf(r)) === 1 ? l.sigs.get(sigOf(r)) ?? undefined : undefined);
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
