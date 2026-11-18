// Pares de cuadros consecutivos alrededor de los cambios de `data-qa-settled` y de aparición del `data-qa-target` (regla `salto`).
//
// El muestreo repartido (`--count 40` sobre 4800 cuadros) casi nunca cae donde la cámara llega a un foco o cambia el objetivo, que es justo donde saltan las etiquetas.
// Se mira una firma barata del cuadro (¿hay un mundo asentado?, ¿qué objetivos hay?) en una grilla de a lo sumo `MAX_GRID` cuadros y, donde la firma cambia entre dos puntos
// de la grilla, se biseca hasta el primer cuadro con la firma nueva. Cada uno de esos cuadros se suma al muestreo (con sus vecinos f-1 y f+1: los pares (f-1, f) y (f, f+1)).
// Cada sonda renderiza un cuadro (0,2 a 0,5 s en una escena pesada): por eso la grilla es corta y se reparte entre las paginas de la corrida. Costo acotado: <= MAX_GRID sondas de grilla + log2(paso) por cambio, y a lo sumo `max` cuadros extra (con más cambios se eligen repartidos). Un cambio que empieza y termina
// entre dos puntos de la grilla (un asentado más corto que el paso) no se ve; `--pares N` no lo arregla, sí `--count`/`--every` o `--frames`.
export const MAX_GRID = 100;
/** Cuadros extra por defecto para pares (`--pares`): 0 = solo los pares de los cuadros ya muestreados. */
export const DEFAULT_PARES = 40;

type Sig = (frame: number) => Promise<string>;

/**
 * Primeros cuadros con una firma distinta de la anterior, buscados en `[from, to]`; `probes` cuenta las firmas pedidas (sin repetir) y `found` los cambios.
 * `sigs`: una función de firma por página abierta; las sondas se reparten entre ellas (el resultado no depende de cuál responde cada una).
 */
export async function findTransitions(sigs: Sig[] | Sig, from: number, to: number, max: number): Promise<{ frames: number[]; probes: number; found: number }> {
  const pool = Array.isArray(sigs) ? sigs : [sigs];
  if (max <= 0 || to <= from || !pool.length) return { frames: [], probes: 0, found: 0 };
  const cache = new Map<number, Promise<string>>();
  const at = (f: number, w: Sig) => {
    let c = cache.get(f);
    if (!c) cache.set(f, (c = w(f)));
    return c;
  };
  const step = Math.max(1, Math.ceil((to - from + 1) / MAX_GRID));
  const grid: number[] = [];
  for (let f = from; f < to; f += step) grid.push(f);
  grid.push(to);
  // La grilla se sondea en paralelo; despues cada tramo con firma distinta se biseca por su cuenta (en paralelo entre tramos).
  const each = async <T>(n: number, fn: (i: number, w: Sig) => Promise<T>): Promise<T[]> => {
    const out: T[] = new Array(n);
    let i = 0;
    await Promise.all(pool.map(async (w) => { for (let k = i++; k < n; k = i++) out[k] = await fn(k, w); }));
    return out;
  };
  const g = await each(grid.length, (k, w) => at(grid[k]!, w));
  const spans = grid.slice(0, -1).map((lo, k) => ({ lo, hi: grid[k + 1]!, a: g[k]!, b: g[k + 1]! })).filter((x) => x.a !== x.b);
  const found = await each(spans.length, async (k, w) => {
    let { lo, hi } = spans[k]!;
    const a = spans[k]!.a;
    while (hi - lo > 1) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if ((await at(mid, w)) === a) lo = mid; else hi = mid;
    }
    return hi;
  });
  const frames = found.length <= max ? found : Array.from({ length: max }, (_, i) => found[Math.round((i * (found.length - 1)) / Math.max(1, max - 1))]!);
  return { frames: [...new Set(frames)], probes: cache.size, found: found.length };
}
