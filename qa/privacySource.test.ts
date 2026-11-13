// @vitest-environment node
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runPrivacy } from './privacy';

// Escaneo del codigo fuente sin video: la lista --deny no debe reportarse a si misma.
describe('privacy --scan-source', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'privsrc-'));
    mkdirSync(join(dir, 'v'));
    writeFileSync(join(dir, 'v', 'prohibidos.txt'), 'zzcorp\n');
    writeFileSync(join(dir, 'v', 'otra-lista.txt'), 'zzcorp\n');
    writeFileSync(join(dir, 'v', 'escena.tsx'), 'export const x = "ok";\n');
    return dir;
  };

  it('salta el archivo pasado a --deny y cualquier prohibidos.txt', async () => {
    const dir = setup();
    const r = await runPrivacy({ deny: 'zzcorp\n', scanSource: [join(dir, 'v')], skipFiles: [join(dir, 'v', 'otra-lista.txt')] });
    expect(r.findings).toEqual([]);
    expect(r.scannedFiles).toBe(1);
  });

  it('resuelve rutas reales (enlace simbolico a la lista)', async () => {
    const dir = setup();
    symlinkSync(join(dir, 'v', 'otra-lista.txt'), join(dir, 'v', 'enlace.txt'));
    const r = await runPrivacy({ deny: 'zzcorp\n', scanSource: [join(dir, 'v')], skipFiles: [join(dir, 'v', 'otra-lista.txt')] });
    expect(r.findings).toEqual([]);
  });

  it('sigue encontrando el termino en el resto del codigo', async () => {
    const dir = setup();
    writeFileSync(join(dir, 'v', 'malo.tsx'), 'const c = "ZZCorp";\n');
    const r = await runPrivacy({ deny: 'zzcorp\n', scanSource: [join(dir, 'v')], skipFiles: [join(dir, 'v', 'otra-lista.txt')] });
    expect(r.findings.map((f) => f.where)).toEqual([expect.stringContaining('malo.tsx:1')]);
  });
});
