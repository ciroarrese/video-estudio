// @vitest-environment node
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fichasEmuladas, runPrivacy } from './privacy';

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

  it('no escanea videos/<slug>/referencias/ (material de referencia con datos reales) pero sí el resto', async () => {
    const dir = setup();
    mkdirSync(join(dir, 'v', 'referencias'));
    writeFileSync(join(dir, 'v', 'referencias', 'notas.md'), 'la captura muestra a ZZCorp\n');
    const r = await runPrivacy({ deny: 'zzcorp\n', scanSource: [join(dir, 'v')], skipFiles: [join(dir, 'v', 'otra-lista.txt')] });
    expect(r.findings).toEqual([]);
    expect(r.scannedFiles).toBe(1);
    writeFileSync(join(dir, 'v', 'malo.tsx'), 'const c = "ZZCorp";\n');
    expect((await runPrivacy({ deny: 'zzcorp\n', scanSource: [join(dir, 'v')], skipFiles: [join(dir, 'v', 'otra-lista.txt')] })).findings.map((f) => f.where)).toEqual([expect.stringContaining('malo.tsx:1')]);
  });

  it('sigue encontrando el termino en el resto del codigo', async () => {
    const dir = setup();
    writeFileSync(join(dir, 'v', 'malo.tsx'), 'const c = "ZZCorp";\n');
    const r = await runPrivacy({ deny: 'zzcorp\n', scanSource: [join(dir, 'v')], skipFiles: [join(dir, 'v', 'otra-lista.txt')] });
    expect(r.findings.map((f) => f.where)).toEqual([expect.stringContaining('malo.tsx:1')]);
  });
});

// Ficha de datos emulados (`datos-emulados.txt`): lista de permitidos que se toma sola; no se escanea como codigo.
describe('ficha de datos emulados', () => {
  it('fichasEmuladas encuentra datos-emulados.txt en cada carpeta (sin repetir) y nada donde no hay', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ficha-'));
    mkdirSync(join(dir, 'con')); mkdirSync(join(dir, 'sin'));
    writeFileSync(join(dir, 'con', 'datos-emulados.txt'), '0001-00001234\n');
    expect(fichasEmuladas([join(dir, 'con'), join(dir, 'sin'), join(dir, 'con')])).toEqual([join(dir, 'con', 'datos-emulados.txt')]);
    expect(fichasEmuladas([join(dir, 'sin')])).toEqual([]);
  });
  it('el escaneo del codigo no reporta la ficha aunque lleve valores con forma de dato (correo, dominio) y sigue mirando el resto', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ficha-'));
    writeFileSync(join(dir, 'datos-emulados.txt'), 'persona@dominio-ficticio.example.io\n');
    writeFileSync(join(dir, 'escena.tsx'), 'export const x = "ok";\n');
    const r = await runPrivacy({ deny: 'zzcorp\n', scanSource: [dir] });
    expect(r.findings).toEqual([]);
    expect(r.scannedFiles).toBe(1);
    writeFileSync(join(dir, 'malo.tsx'), 'const c = "persona@dominio-ficticio.example.io";\n');
    expect((await runPrivacy({ deny: 'zzcorp\n', scanSource: [dir] })).findings).toHaveLength(1);
    // con la ficha como lista de permitidos (lo que hace la CLI), ese correo ya no se reporta
    const allowed = await runPrivacy({ deny: 'zzcorp\n', allow: 'persona@dominio-ficticio.example.io\n', scanSource: [dir] });
    expect(allowed.findings).toEqual([]);
  });
});
