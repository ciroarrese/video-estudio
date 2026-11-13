// Lectura y validación de las opciones de la línea de comandos de audio (sin efectos secundarios,
// para poder probarla sin ffmpeg).

export function parsear(argv: string[]): { pos: string[]; op: Map<string, string> } {
  const pos: string[] = [];
  const op = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const sig = argv[i + 1];
      if (sig === undefined || sig.startsWith('--')) op.set(a.slice(2), '');
      else {
        op.set(a.slice(2), sig);
        i++;
      }
    } else pos.push(a);
  }
  return { pos, op };
}

export interface RestriccionNum {
  /** Valor mínimo permitido (inclusive). */
  min?: number;
  /** Si es true, el valor tiene que ser estrictamente mayor que `min`. */
  excluyeMin?: boolean;
  entero?: boolean;
}

/** Lee `--k` como número finito. Una bandera sin valor, un texto o un valor fuera de rango fallan con un mensaje claro. */
export function leerNum(op: Map<string, string>, k: string, def?: number, r: RestriccionNum = {}): number | undefined {
  const v = op.get(k);
  if (v === undefined) return def;
  if (v.trim() === '') throw new Error(`--${k} necesita un valor numérico`);
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${k} tiene que ser un número (recibió "${v}")`);
  if (r.entero && !Number.isInteger(n)) throw new Error(`--${k} tiene que ser un entero (recibió "${v}")`);
  if (r.min !== undefined && (r.excluyeMin ? n <= r.min : n < r.min)) {
    throw new Error(`--${k} tiene que ser ${r.excluyeMin ? 'mayor que' : 'al menos'} ${r.min} (recibió "${v}")`);
  }
  return n;
}

/** `--inicio`: la palabra `percusion` o un segundo (número >= 0). Devuelve undefined si no se pasó. */
export function leerInicio(op: Map<string, string>): 'percusion' | number | undefined {
  const v = op.get('inicio');
  if (v === undefined) return undefined;
  if (v === 'percusion') return 'percusion';
  if (v.trim() === '') throw new Error('--inicio necesita un valor: "percusion" o un segundo (por ejemplo --inicio 4.5)');
  return leerNum(op, 'inicio', undefined, { min: 0 });
}
