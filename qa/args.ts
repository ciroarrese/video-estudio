export type Parsed = { positional: string[]; flags: Map<string, string[]>; bools: Set<string> };

const BOOLEAN = new Set(['help', 'labels', 'no-labels', 'phones', 'verbose']);

/** Tiny flag parser: `--name value`, `--name=value`, repeatable, boolean flags listed in BOOLEAN. */
export function parseArgs(argv: string[]): Parsed {
  const p: Parsed = { positional: [], flags: new Map(), bools: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-h') { p.bools.add('help'); continue; }
    if (!a.startsWith('--')) { p.positional.push(a); continue; }
    const eq = a.indexOf('=');
    const name = (eq < 0 ? a.slice(2) : a.slice(2, eq));
    if (BOOLEAN.has(name)) { p.bools.add(name); continue; }
    let v: string | undefined = eq < 0 ? argv[++i] : a.slice(eq + 1);
    if (v === undefined) throw new Error(`Falta el valor de --${name}`);
    const list = p.flags.get(name) ?? [];
    list.push(v);
    p.flags.set(name, list);
    v = undefined;
  }
  return p;
}

export const one = (p: Parsed, name: string): string | undefined => p.flags.get(name)?.at(-1);
export const num = (p: Parsed, name: string): number | undefined => {
  const v = one(p, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${name} debe ser un numero`);
  return n;
};
export const json = (p: Parsed, name: string): Record<string, unknown> | undefined => {
  const v = one(p, name);
  if (v === undefined) return undefined;
  let o: unknown;
  try { o = JSON.parse(v); } catch (e) { throw new Error(`--${name} no es JSON valido: ${(e as Error).message}`); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error(`--${name} debe ser un objeto JSON`);
  return o as Record<string, unknown>;
};
