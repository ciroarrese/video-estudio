// "Detalle que se lee al acercar": regla de principio para `min-size` en interfaces densas recreadas.
//
// Un tablero que se muestra entero y después se acerca tiene cientos de textos por debajo del mínimo en el plano general. Si cada
// uno fuera un error, el informe sería inútil (1112 hallazgos en un solo cuadro) y taparía los defectos reales. La regla:
//
//   - Un texto por debajo del mínimo en el cuadro muestreado que, DENTRO DE LA MISMA ESCENA y mientras es visible (opacidad >=
//     `min-size.minOpacity`, centro dentro del cuadro), se ve en otro cuadro (antes o después) con tamaño en pantalla >= mínimo, es
//     un "detalle que se lee al acercar": info, con UNA línea resumen por cuadro (cuántos textos, el menor, cuándo se leen).
//   - Un texto que en ningún cuadro mirado de su escena llega al mínimo sigue siendo error (nunca se lee a un tamaño legible).
//
// "Mismo texto" = misma clave (ruta DOM + etiqueta + testid + texto); "misma escena" = la escena con nombre más chica que contiene el
// cuadro (o todo el video si no declara escenas). Para saber si se lee en otro cuadro se miran `min-size.probeFrames` cuadros
// repartidos de la escena (más los muestreados) con el modo liviano de la recolección (sin tapados ni recortes): es un muestreo, así
// que un acercamiento más breve que el paso entre cuadros mirados puede no verse (subir `--set min-size.probeFrames=N`).
// `probeFrames=0` apaga la regla: todo texto chico es error, como antes.
import type { SceneInfo } from '../engine';
import { collectRuns } from './page';
import { evenFrames } from './sampling';
import type { Session } from './session';
import type { DetailSummary, Finding, Thresholds } from './types';

export type Scope = { id: string; from: number; to: number };
export type Readable = { px: number; frame: number };

/** La escena más chica que contiene el cuadro; sin escenas con nombre, todo el video. */
export function scopeOf(frame: number, scenes: Pick<SceneInfo, 'id' | 'from' | 'durationInFrames'>[], duration: number): Scope {
  let best: Scope | null = null;
  for (const s of scenes) {
    const to = s.from + s.durationInFrames - 1;
    if (frame < s.from || frame > to) continue;
    if (!best || to - s.from < best.to - best.from) best = { id: s.id, from: s.from, to };
  }
  return best ?? { id: '', from: 0, to: duration - 1 };
}

const scopeKey = (s: Scope) => `${s.id}|${s.from}|${s.to}`;

export const candidatesOf = (findings: Finding[]): Finding[] => findings.filter((f) => f.rule === 'min-size' && f.severity === 'error' && typeof f.data?.key === 'string');

/**
 * Para cada escena con candidatos, mira cuadros de esa escena y anota, por clave de texto, el mayor tamaño en pantalla con el que se
 * ve (visible y dentro del cuadro). Devuelve `escena -> clave -> {px, frame}`.
 */
export async function probeReadable(
  session: Session,
  candidates: Finding[],
  scenes: SceneInfo[],
  sampled: number[],
  thresholds: Thresholds,
  dims: { width: number; height: number; duration: number },
): Promise<Map<string, Map<string, Readable>>> {
  const t = thresholds['min-size'];
  const byScope = new Map<string, { scope: Scope; keys: Set<string> }>();
  for (const f of candidates) {
    const sc = scopeOf(f.frame, scenes, dims.duration);
    const e = byScope.get(scopeKey(sc)) ?? byScope.set(scopeKey(sc), { scope: sc, keys: new Set() }).get(scopeKey(sc))!;
    e.keys.add(f.data!.key as string);
  }
  const out = new Map<string, Map<string, Readable>>();
  if (!byScope.size) return out;
  const vp = await session.openPage();
  try {
    for (const [sk, { scope, keys }] of byScope) {
      const frames = new Set(evenFrames(scope.to - scope.from + 1, t.probeFrames).map((n) => n + scope.from));
      for (const f of sampled) if (f >= scope.from && f <= scope.to) frames.add(f);
      const best = new Map<string, Readable>();
      for (const f of [...frames].sort((a, b) => a - b)) {
        await vp.setFrame(f);
        const data = await collectRuns(vp, dims.width, dims.height, [], [...keys]);
        for (const r of data.runs) {
          const cx = r.rect.x + r.rect.w / 2;
          const cy = r.rect.y + r.rect.h / 2;
          if (r.opacity < t.minOpacity || cx < 0 || cy < 0 || cx > dims.width || cy > dims.height) continue; // invisible o fuera del cuadro: no cuenta como "mostrado"
          if (r.screenPx > (best.get(r.key)?.px ?? -1)) best.set(r.key, { px: r.screenPx, frame: f });
        }
      }
      out.set(sk, best);
    }
  } finally {
    await vp.close();
  }
  return out;
}

/**
 * Reemplaza los errores `min-size` de textos que se leen al acercar por UN hallazgo info por cuadro (resumen con la cuenta).
 * Devuelve los hallazgos nuevos y el resumen global (textos distintos y cuadros afectados). Pura: no toca el navegador.
 */
export function reclassifyDetail(
  findings: Finding[],
  readable: Map<string, Map<string, Readable>>,
  scenes: Pick<SceneInfo, 'id' | 'from' | 'durationInFrames'>[],
  thresholds: Thresholds,
  dims: { width: number; height: number; duration: number },
): { findings: Finding[]; detail: DetailSummary | null } {
  const t = thresholds['min-size'];
  const min = (t.minPx1080 * Math.min(dims.width, dims.height)) / 1080;
  const perFrame = new Map<number, { items: Finding[]; where: Readable[] }>();
  const keep: Finding[] = [];
  const texts = new Set<string>();
  for (const f of findings) {
    const key = f.rule === 'min-size' && f.severity === 'error' ? f.data?.key : undefined;
    const r = typeof key === 'string' ? readable.get(scopeKey(scopeOf(f.frame, scenes, dims.duration)))?.get(key) : undefined;
    if (!r || r.px < min - t.tolerancePx) {
      keep.push(f);
      continue;
    }
    texts.add(`${scopeKey(scopeOf(f.frame, scenes, dims.duration))}|${key as string}`);
    const e = perFrame.get(f.frame) ?? perFrame.set(f.frame, { items: [], where: [] }).get(f.frame)!;
    e.items.push(f);
    e.where.push(r);
  }
  const summary: Finding[] = [];
  for (const [frame, { items, where }] of perFrame) {
    const smallest = items.reduce((a, b) => (Number(b.data!.screenPx) < Number(a.data!.screenPx) ? b : a));
    const at = where.reduce((a, b) => (b.px > a.px ? b : a));
    summary.push({
      rule: 'min-size', severity: 'info', frame,
      message: `${items.length} ${items.length === 1 ? 'texto' : 'textos'} por debajo del mínimo (${min.toFixed(1)}px) a este zoom que se ${items.length === 1 ? 'lee' : 'leen'} al acercar dentro de la misma escena (el menor: ${smallest.data!.screenPx}px; se ven hasta a ${at.px.toFixed(1)}px en el cuadro ${at.frame}): detalle, no es error`,
      element: smallest.element,
      data: { count: items.length, detail: true, smallestPx: Number(smallest.data!.screenPx), readableFrame: at.frame, readablePx: Math.round(at.px * 10) / 10 },
    });
  }
  return { findings: [...keep, ...summary], detail: perFrame.size ? { texts: texts.size, frames: perFrame.size } : null };
}
