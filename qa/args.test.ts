import { describe, expect, it } from 'vitest';
import { leerListas, parseArgs } from './args';

describe('listas repetibles de privacy (--deny / --allow)', () => {
  const archivos: Record<string, string> = { 'a.txt': 'uno\ndos', 'b.txt': 'tres\n', 'c.txt': '' };
  const leer = (r: string) => {
    if (!(r in archivos)) throw new Error('no existe');
    return archivos[r]!;
  };
  it('junta todos los archivos pasados, en orden, como si fueran uno', () => {
    const p = parseArgs(['v', '--allow', 'a.txt', '--allow=b.txt', '--allow', 'c.txt']);
    const r = leerListas(p, 'allow', leer);
    expect(r.rutas).toEqual(['a.txt', 'b.txt', 'c.txt']);
    expect(r.contenido.split('\n').filter(Boolean)).toEqual(['uno', 'dos', 'tres']); // el último renglón del primero no se pega al primero del segundo
  });
  it('sin la opción: vacío; con un archivo ilegible, un error que dice cuál', () => {
    expect(leerListas(parseArgs(['v']), 'allow', leer)).toEqual({ rutas: [], contenido: '' });
    expect(() => leerListas(parseArgs(['--allow', 'a.txt', '--allow', 'falta.txt']), 'allow', leer)).toThrow(/--allow falta\.txt: no se pudo leer/);
  });
});
