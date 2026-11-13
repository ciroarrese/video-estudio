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

export type Inicio = 'percusion' | number | { seccion: number };

/** `--inicio`: `percusion`, `seccion:<n>` (n desde 1, de la lista `secciones` del tempo) o un segundo (número >= 0). Devuelve undefined si no se pasó. */
export function leerInicio(op: Map<string, string>): Inicio | undefined {
  const v = op.get('inicio');
  if (v === undefined) return undefined;
  if (v === 'percusion') return 'percusion';
  if (v.trim() === '') throw new Error('--inicio necesita un valor: "percusion", "seccion:<n>" o un segundo (por ejemplo --inicio 4.5)');
  const m = /^seccion:(.*)$/.exec(v);
  if (m) {
    const n = Number(m[1]);
    if (m[1].trim() === '' || !Number.isInteger(n) || n < 1) throw new Error(`--inicio seccion:<n> necesita un entero desde 1 (recibió "${v}")`);
    return { seccion: n };
  }
  return leerNum(op, 'inicio', undefined, { min: 0 });
}

/**
 * `--corte-en`: una lista separada por comas de instantes de la salida donde conviene un empalme.
 * Cada uno es un segundo (`12.5`) o un cuadro con prefijo `f` (`f375`, se pasa a segundos con `fps`).
 */
export function leerCortes(op: Map<string, string>, fps: number): number[] | undefined {
  const v = op.get('corte-en');
  if (v === undefined) return undefined;
  if (v.trim() === '') throw new Error('--corte-en necesita un valor: segundos de salida o cuadros con prefijo f (por ejemplo --corte-en 12.5,f450)');
  return v.split(',').map((t) => {
    const txt = t.trim();
    const esCuadro = txt.startsWith('f');
    const n = Number(esCuadro ? txt.slice(1) : txt);
    if (txt === '' || txt === 'f' || !Number.isFinite(n) || n < 0) throw new Error(`--corte-en: "${txt}" no es un segundo ni un cuadro (f<n>) válido`);
    return esCuadro ? n / fps : n;
  });
}

/** `--fase medio`: corre la grilla de pulsos medio pulso. Cualquier otro valor es un error. */
export function leerFase(op: Map<string, string>): 'medio' | undefined {
  const v = op.get('fase');
  if (v === undefined) return undefined;
  if (v !== 'medio') throw new Error(`--fase solo acepta "medio" (recibió "${v}")`);
  return 'medio';
}

/** `--final fade|real`: cómo termina el video (caída artificial o el final propio de la pista). */
export function leerFinal(op: Map<string, string>): 'fade' | 'real' | undefined {
  const v = op.get('final');
  if (v === undefined) return undefined;
  if (v !== 'fade' && v !== 'real') throw new Error(`--final solo acepta "fade" o "real" (recibió "${v}")`);
  return v;
}
