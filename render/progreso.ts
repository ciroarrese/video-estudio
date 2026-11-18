// Progreso de la captura con tiempo restante estimado.
//
// Una línea por cada 5 % (y, si un tramo es muy lento, al menos una por minuto): sirve igual en una terminal que en un log
// no interactivo, sin retornos de carro ni códigos de control. La estimación usa la velocidad RECIENTE (últimos ~60 s) y no el
// promedio desde el inicio, porque los primeros cuadros (arranque de las páginas) y las escenas pesadas la sesgan.

/** `45 s`, `3 min 05 s`, `1 h 02 min`. */
export function formatearDuracion(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/**
 * Segundos que faltan, o `null` si todavía no hay datos para estimar. `muestras` son (instante en ms, cuadros hechos) en orden;
 * se usa la pendiente de la ventana (`ventanaMs`) cuando abarca al menos 3 s y si no, el promedio desde el inicio.
 */
export function estimarRestante(muestras: readonly { t: number; hechos: number }[], total: number, ventanaMs = 60_000): number | null {
  const ult = muestras[muestras.length - 1];
  const prim = muestras[0];
  if (!ult || !prim || ult.hechos <= 0) return null;
  const desde = muestras.find((m) => ult.t - m.t <= ventanaMs) ?? prim;
  const ref = ult.t - desde.t >= 3000 && ult.hechos > desde.hechos ? desde : prim;
  const dt = (ult.t - ref.t) / 1000;
  const df = ult.hechos - ref.hechos;
  if (dt <= 0 || df <= 0) return null;
  return ((total - ult.hechos) * dt) / df;
}

export type OpcionesProgreso = { ahora?: () => number; cadaMs?: number; ventanaMs?: number };

/** Devuelve `(hechos, total) => void`: llamala por cada cuadro terminado; imprime con `log` cuando toca. */
export function crearProgreso(log: (m: string) => void, etiqueta: string, o: OpcionesProgreso = {}): (hechos: number, total: number) => void {
  const ahora = o.ahora ?? Date.now;
  const cadaMs = o.cadaMs ?? 60_000;
  const ventanaMs = o.ventanaMs ?? 60_000;
  const t0 = ahora();
  const muestras: { t: number; hechos: number }[] = [];
  let ultimoPct = 0; // no imprime el 0 %
  let ultimoLog = t0;
  return (hechos, total) => {
    const t = ahora();
    muestras.push({ t, hechos });
    // solo hace falta la ventana reciente y el primer punto
    while (muestras.length > 2 && t - muestras[1]!.t > ventanaMs) muestras.splice(1, 1);
    const pct = Math.floor((hechos / total) * 20) * 5;
    const porPorcentaje = pct > ultimoPct;
    const porTiempo = !porPorcentaje && hechos < total && t - ultimoLog >= cadaMs;
    if (!porPorcentaje && !porTiempo) return;
    ultimoPct = Math.max(ultimoPct, pct);
    ultimoLog = t;
    const fps = hechos / Math.max((t - t0) / 1000, 0.001);
    const restante = hechos < total ? estimarRestante(muestras, total, ventanaMs) : null;
    const pctTxt = porTiempo ? Math.floor((hechos / total) * 100) : pct;
    log(`${etiqueta}: ${pctTxt}% (${hechos}/${total} cuadros, ${fps.toFixed(1)} fps${restante === null ? '' : `, faltan ~${formatearDuracion(restante)}`})`);
  };
}
