// Detector de saltos: compara cuadros vecinos y avisa de lo que se mueve de golpe, en un solo cuadro, cuando nada lo explica.
//
// Solo mira videos que marcan su interfaz recreada (`data-qa-world`, `data-qa-overlay`, `data-qa-target`, ver qa/world.ts): fuera de eso no hay una cámara contra la
// cual medir y un movimiento brusco puede ser el efecto buscado (una tarjeta que vuela). Para un cuadro f se miran los dos pasos (f-1, f) y (f, f+1).
//
//  1. Elemento del mundo: texto dentro de `data-qa-world`. Se predice dónde tendría que estar en el cuadro vecino si solo se hubiera movido la cámara (su posición
//     relativa a la caja del mundo, llevada a la caja del mundo del otro cuadro) y se mide la diferencia con donde está de verdad (`residuo`, px de pantalla).
//  2. Capa fija: `data-qa-overlay`. Con un objetivo (`data-qa-target`) como ancla, el residuo es el cambio de la posición de la capa RELATIVA al objetivo (centro contra centro);
//     sin objetivo en ningún cuadro, lo que la capa se mueve de más que el mundo (si el objetivo cambia entre los dos cuadros, no hay ancla común y no se juzga).
//  (`data-qa-overlay="progreso"`, la barra de progreso fija, no se juzga: no tiene ancla.)
//  3. Cambio de lado: una capa que cambia de lado respecto de su ancla (izquierda, derecha, arriba, abajo) entre dos cuadros seguidos, con el mismo objetivo y la misma capa.
//
// Es un SALTO (aviso) cuando el residuo de un paso llega a `salto.px` (24 px a 1080 de lado corto, escalado con el cuadro) y el del otro paso es menor que `salto.ratio` (0,25)
// veces el primero: un movimiento aislado, no continuo. Un movimiento continuo (un vuelo, una cámara rápida, un easing) mueve el elemento en varios cuadros seguidos y no es un salto.
// No son saltos (no se juzgan): lo que aparece o desaparece (sin pareja en el cuadro vecino, o con la opacidad cambiando más de `salto.fade` por cuadro: una entrada con animación),
// lo muy tenue (< `salto.minOpacity`), un texto cuyo contenido cambia (otra clave), el paso que cruza el inicio de una escena (un corte) y un paso donde menos de la mitad del mundo
// tiene pareja (un cambio de pantalla). Los cambios de lado no piden aislamiento (cambiar de lado dos cuadros seguidos son dos avisos). Se calla con `data-qa-ignore="salto"`.
import { describe, rectShift, roundRect } from './geometry';
import { looseKey, sigOf } from './motion';
import type { AnchorInfo, Finding, Geom, Rect, RuleContext, TextRun, WorldInfo } from './types';

export type PairStatus = 'juzgado' | 'corte' | 'sin-elementos';
export type SaltoAnalysis = { findings: Finding[]; prev?: PairStatus; next?: PairStatus };
type Side = 'izquierda' | 'derecha' | 'arriba' | 'abajo' | null;

const ctr = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const dist = (a: Rect, b: Rect) => Math.hypot(ctr(a).x - ctr(b).x, ctr(a).y - ctr(b).y);
const anchorInfo = (a: AnchorInfo) => ({ tag: a.tag, testid: a.testid, text: a.text, rect: roundRect(a.rect) });

/** Lado de la capa respecto de su ancla; `null` si no está claro (encima, o en diagonal sin un eje que mande por más de 0,15). */
export function sideOf(o: Rect, a: Rect): Side {
  const c = ctr(o), d = ctr(a);
  const nx = (c.x - d.x) / ((o.w + a.w) / 2 || 1);
  const ny = (c.y - d.y) / ((o.h + a.h) / 2 || 1);
  const ax = Math.abs(nx), ay = Math.abs(ny);
  if (Math.max(ax, ay) < 0.5 || Math.abs(ax - ay) < 0.15) return null;
  return ax > ay ? (nx < 0 ? 'izquierda' : 'derecha') : ny < 0 ? 'arriba' : 'abajo';
}

/** Dónde quedaría `r` (en el cuadro de `to`) si solo se hubiera movido el mundo de `from` a `to`: su posición relativa a la caja del mundo, llevada a la nueva. */
function predict(r: Rect, from: WorldInfo, to: WorldInfo): Rect {
  const fw = from.rect.w || 1, fh = from.rect.h || 1;
  return { x: to.rect.x + ((r.x - from.rect.x) / fw) * to.rect.w, y: to.rect.y + ((r.y - from.rect.y) / fh) * to.rect.h, w: (r.w / fw) * to.rect.w, h: (r.h / fh) * to.rect.h };
}

type Look = { byKey: Map<string, TextRun>; sigs: Map<string, TextRun | null> };
function lookOf(runs: TextRun[]): Look {
  const byKey = new Map<string, TextRun>();
  const sigs = new Map<string, TextRun | null>();
  for (const r of runs) {
    const sg = sigOf(r);
    sigs.set(sg, sigs.has(sg) ? null : r);
    byKey.set(r.key, r);
    const lk = looseKey(r);
    if (lk && !byKey.has(lk)) byKey.set(lk, r);
  }
  return { byKey, sigs };
}
/** La pareja de `r` en otro cuadro: misma clave, o la clave de un contador, o (si es único en los dos cuadros) la misma firma; igual que `applyMotion`. */
const matchRun = (r: TextRun, l: Look, unique: boolean): TextRun | undefined => l.byKey.get(r.key) ?? (looseKey(r) ? l.byKey.get(looseKey(r)!) : undefined) ?? (unique ? l.sigs.get(sigOf(r)) ?? undefined : undefined);

/** Un paso entre dos cuadros para un elemento: residuo (px), cambio de opacidad y la menor opacidad; para una capa con ancla, el lado antes y después. */
type Step = { res: number; fade: number; op: number; before?: Side; after?: Side; anchor?: AnchorInfo };
type PairData = { total: number; matched: number; runs: Map<number, Step>; camPx: number; overlays: Map<string, Step>; overlaysMatched: number };

const keyed = <T extends { key: string }>(xs: T[] | undefined, key: string) => xs?.find((x) => x.key === key);

/**
 * El paso entre `cur` y `other`: 'prev' es (other -> cur), 'next' es (cur -> other). Se indexa por el texto (id) o la capa (clave) de `cur`; el residuo se mide en el cuadro
 * de destino. `unique`: firmas (etiqueta|testid|texto) que aparecen una sola vez en `cur`.
 */
function pairData(cur: Geom, other: Geom, dir: 'prev' | 'next', unique: Set<string>): PairData {
  const out: PairData = { total: 0, matched: 0, runs: new Map(), camPx: 0, overlays: new Map(), overlaysMatched: 0 };
  const [fromG, toG] = dir === 'prev' ? [other, cur] : [cur, other];
  for (const w of cur.worlds ?? []) {
    const o = keyed(other.worlds, w.key);
    if (o) out.camPx = Math.max(out.camPx, rectShift(w.rect, o.rect));
  }
  const look = lookOf(other.runs);
  for (const r of cur.runs) {
    if (!r.world || r.overlay) continue;
    out.total++;
    const m = matchRun(r, look, unique.has(sigOf(r)));
    if (!m) continue;
    out.matched++;
    const [a, b] = dir === 'prev' ? [m, r] : [r, m];
    const wa = keyed(fromG.worlds, a.world?.key ?? ''), wb = keyed(toG.worlds, b.world?.key ?? '');
    if (!wa || !wb) continue;
    out.runs.set(r.id, { res: rectShift(predict(a.rect, wa, wb), b.rect), fade: Math.abs(a.opacity - b.opacity), op: Math.min(a.opacity, b.opacity) });
  }
  for (const o of cur.overlays ?? []) {
    if (o.kind === 'progreso') continue; // barra de progreso: fija en pantalla mientras el objetivo viaja con la camara; no tiene ancla
    const m = keyed(other.overlays, o.key);
    if (!m) continue;
    out.overlaysMatched++;
    const [a, b] = dir === 'prev' ? [m, o] : [o, m];
    const fade = Math.abs(a.opacity - b.opacity), op = Math.min(a.opacity, b.opacity);
    // ancla: el objetivo de `cur` más cercano a la capa que tiene pareja (misma clave) en el otro cuadro
    const t = (cur.targets ?? []).filter((x) => keyed(other.targets, x.key)).sort((p, q) => dist(p.rect, o.rect) - dist(q.rect, o.rect))[0];
    if (!t) {
      if (cur.targets?.length || other.targets?.length) continue; // el objetivo cambió (la capa se va con él): no hay ancla común contra la que medir
      out.overlays.set(o.key, { res: Math.max(0, rectShift(a.rect, b.rect) - out.camPx), fade, op });
      continue;
    }
    const tOther = keyed(other.targets, t.key)!;
    const [ta, tb] = dir === 'prev' ? [tOther, t] : [t, tOther];
    const da = { x: ctr(a.rect).x - ctr(ta.rect).x, y: ctr(a.rect).y - ctr(ta.rect).y }, db = { x: ctr(b.rect).x - ctr(tb.rect).x, y: ctr(b.rect).y - ctr(tb.rect).y };
    out.overlays.set(o.key, { res: Math.hypot(db.x - da.x, db.y - da.y), fade, op, before: sideOf(a.rect, ta.rect), after: sideOf(b.rect, tb.rect), anchor: t });
  }
  return out;
}

const uniqueSigs = (runs: TextRun[]): Set<string> => {
  const n = new Map<string, number>();
  for (const r of runs) n.set(sigOf(r), (n.get(sigOf(r)) ?? 0) + 1);
  return new Set([...n].filter(([, c]) => c === 1).map(([k]) => k));
};

/** El cuadro usa las marcas (un mundo con texto, una capa o un objetivo): fuera de eso la regla no tiene contra qué medir. */
export const usesMarks = (g: Geom): boolean => !!(g.worlds?.length || g.overlays?.length || g.targets?.length);

function statusOf(d: PairData, cut: boolean | undefined): PairStatus {
  if (cut) return 'corte';
  if (d.total >= 4 && d.matched / d.total < 0.5) return 'corte'; // la mitad del mundo no tiene pareja: otra pantalla
  return d.matched > 0 || d.overlaysMatched > 0 ? 'juzgado' : 'sin-elementos';
}

/** Los saltos de un cuadro (con los dos pasos vecinos) y el estado de cada paso: la regla `salto` usa los hallazgos; `qa` cuenta los estados. */
export function analyzeJumps(ctx: Pick<RuleContext, 'frame' | 'width' | 'height' | 'runs' | 'worlds' | 'overlays' | 'targets' | 'thresholds' | 'around'>): SaltoAnalysis {
  const cur: Geom = { runs: ctx.runs, worlds: ctx.worlds, overlays: ctx.overlays, targets: ctx.targets };
  const ar = ctx.around;
  const out: SaltoAnalysis = { findings: [] };
  if (!ar || !usesMarks(cur)) return out;
  const t = ctx.thresholds.salto;
  const J = (t.px * Math.min(ctx.width, ctx.height)) / 1080;
  const unique = uniqueSigs(cur.runs);
  const p1 = ar.prev ? pairData(cur, ar.prev, 'prev', unique) : undefined;
  const p2 = ar.next ? pairData(cur, ar.next, 'next', unique) : undefined;
  if (p1) out.prev = statusOf(p1, ar.cutPrev);
  if (p2) out.next = statusOf(p2, ar.cutNext);
  const live1 = out.prev === 'juzgado' ? p1 : undefined;
  const live2 = out.next === 'juzgado' ? p2 : undefined;
  if (!live1 && !live2) return out;

  /** Hay salto si un paso llega a J y el otro es menor que `ratio` veces ese; sin el otro paso (aparece, desaparece, corte) no se juzga. */
  const jump = (a: Step | undefined, b: Step | undefined): { pair: 'prev' | 'next'; px: number } | null => {
    if (!a || !b) return null;
    const ok = (s: Step) => s.fade <= t.fade && s.op >= t.minOpacity; // una entrada, una salida o algo muy tenue no es un salto
    if (!ok(a) || !ok(b)) return null;
    if (a.res >= J && b.res <= t.ratio * a.res) return { pair: 'prev', px: a.res };
    if (b.res >= J && a.res <= t.ratio * b.res) return { pair: 'next', px: b.res };
    return null;
  };
  const seen = new Set<string>();
  const push = (f: Finding, id: string) => { if (!seen.has(id)) { seen.add(id); out.findings.push(f); } };
  const frameOf = (pair: 'prev' | 'next') => (pair === 'prev' ? ctx.frame : ctx.frame + 1);
  const camOf = (pair: 'prev' | 'next') => Math.round(((pair === 'prev' ? p1 : p2)?.camPx ?? 0) * 10) / 10;
  const pairName = (pair: 'prev' | 'next') => `${frameOf(pair) - 1}-${frameOf(pair)}`;

  for (const r of cur.runs) {
    if (!r.world || r.overlay || r.ignore.includes('salto') || r.ignore.includes('all')) continue;
    const j = jump(live1?.runs.get(r.id), live2?.runs.get(r.id));
    if (!j) continue;
    push({
      rule: 'salto', severity: 'warn', frame: frameOf(j.pair),
      message: `el texto salta ${Math.round(j.px)}px en un solo cuadro respecto del mundo (data-qa-world; la camara se mueve ${camOf(j.pair)}px en ese paso) y en el cuadro vecino casi no se mueve: un salto, no un movimiento continuo. Revisar lo que lo coloca (una proyeccion desfasada un cuadro, una posicion que cambia de golpe)`,
      element: describe(r), data: { px: Math.round(j.px * 10) / 10, camera: camOf(j.pair), pair: pairName(j.pair) },
    }, `w|${r.key}|${frameOf(j.pair)}`);
  }
  for (const o of cur.overlays ?? []) {
    if (o.kind === 'progreso' || o.ignore.includes('salto') || o.ignore.includes('all')) continue;
    const a = live1?.overlays.get(o.key), b = live2?.overlays.get(o.key);
    const j = jump(a, b);
    if (j) {
      const anchor = (j.pair === 'prev' ? a : b)?.anchor;
      push({
        rule: 'salto', severity: 'warn', frame: frameOf(j.pair),
        message: anchor
          ? `la capa fija (data-qa-overlay) cambia ${Math.round(j.px)}px su posicion respecto del objetivo en un solo cuadro y en el cuadro vecino casi no cambia: un salto de la etiqueta respecto de lo que señala`
          : `la capa fija (data-qa-overlay) se mueve ${Math.round(j.px)}px mas que el mundo en un solo cuadro y en el cuadro vecino casi no se mueve: un salto`,
        element: anchorInfo(o), ...(anchor ? { other: anchorInfo(anchor) } : {}), data: { px: Math.round(j.px * 10) / 10, camera: camOf(j.pair), pair: pairName(j.pair) },
      }, `o|${o.key}|${frameOf(j.pair)}`);
    }
    for (const pair of ['prev', 'next'] as const) {
      const s = pair === 'prev' ? a : b;
      if (!s?.anchor || !s.before || !s.after || s.before === s.after || s.fade > t.fade || s.op < t.minOpacity) continue;
      push({
        rule: 'salto', severity: 'warn', frame: frameOf(pair),
        message: `la capa fija (data-qa-overlay) cambia de lado respecto de su objetivo en un solo cuadro (de ${s.before} a ${s.after}): el lado se decide una vez, con la camara asentada, y despues solo sigue al objetivo`,
        element: anchorInfo(o), other: anchorInfo(s.anchor), data: { de: s.before, a: s.after, pair: pairName(pair) },
      }, `s|${o.key}|${frameOf(pair)}`);
    }
  }
  return out;
}
