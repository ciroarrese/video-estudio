// @vitest-environment node
// `templates/nuevo.mjs` (`npm run nuevo`): funciones puras, el programa completo en carpetas temporales y, donde hay bash, que
// dé exactamente lo mismo que `templates/nuevo.sh`. Vive en render/ porque vitest.config.ts no incluye templates/**.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { conBarras, indiceDeEscena, indiceDeHistoria, nombreValido, nuevo, reescribirImports, reescribirTema, reescribirTsconfig } from '../templates/nuevo.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporales: string[] = [];
const carpeta = (p: string) => {
  const d = mkdtempSync(join(tmpdir(), p));
  temporales.push(d);
  return d;
};
afterAll(() => temporales.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** Un proyecto mínimo: copia de templates/ (con las dos versiones del script) y el resto no hace falta para generar. */
const proyecto = () => {
  const d = carpeta('ve-nuevo-mjs-');
  cpSync(join(repo, 'templates'), join(d, 'templates'), { recursive: true });
  return d;
};
const correr = (args: string[], p: string, env: Record<string, string | undefined> = {}) => {
  const out: string[] = [];
  const err: string[] = [];
  const codigo = nuevo(args, (l) => out.push(l), (l) => err.push(l), { repo: p, env });
  return { codigo, out, err };
};
const archivos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivos(join(dir, e.name)) : [join(dir, e.name)])).sort();

describe('templates/nuevo.mjs: funciones puras', () => {
  it('valida slugs y nombres', () => {
    expect(nombreValido('mi-video2')).toBe(true);
    expect(nombreValido('2a')).toBe(true);
    for (const malo of ['', '-x', 'Mayus', 'con espacio', 'a_b', '../x', undefined]) expect(nombreValido(malo)).toBe(false);
  });

  it('reescribe imports, tema, ids y tsconfig', () => {
    expect(reescribirImports('import { a } from "../../engine";\nfrom "../../kit/x"; "../../fx" "../../otra"', 'video-estudio/')).toBe('import { a } from "video-estudio/engine";\nfrom "video-estudio/kit/x"; "video-estudio/fx" "../../otra"');
    expect(reescribirImports('from "../../themes"', '../../../')).toBe('from "../../../themes"');
    expect(reescribirTema('import { n } from "../themes";', '../../')).toBe('import { n } from "../../themes";');
    expect(indiceDeEscena('id: "plantilla-escena",', 'abc', 'uno')).toBe('id: "abc-uno",');
    expect(indiceDeHistoria('from "../scene/Scene"; id: "plantilla-historia"', 'abc', 'uno')).toBe('from "../uno/Scene"; id: "abc"');
    expect(conBarras('C:\\Users\\x\\repo')).toBe('C:/Users/x/repo');
    expect(reescribirTsconfig('"__REPO__/*", "__REPO__/node_modules"', 'C:\\r\\video-studio')).toBe('"C:/r/video-studio/*", "C:/r/video-studio/node_modules"');
  });
});

describe('templates/nuevo.mjs: el programa', () => {
  it('uso incorrecto y nombres inválidos salen con 2', () => {
    const p = proyecto();
    expect(correr([], p).codigo).toBe(2);
    expect(correr(['escena', 'a'], p).err[0]).toMatch(/^Uso: npm run nuevo/);
    expect(correr(['otro', 'a', 'b'], p).codigo).toBe(2);
    expect(correr(['escena', 'Malo', 'b'], p).err).toEqual(['El slug va en minusculas, numeros y guiones.']);
    expect(correr(['escena', 'a', 'B_c'], p).err).toEqual(['El nombre va en minusculas, numeros y guiones.']);
    expect(correr(['externo'], p).err).toEqual(['Falta VE_VIDEOS_DIR (la carpeta de videos fuera del repo).']);
  });

  it('crea la escena en videos/<slug>, con imports relativos y id; la segunda vez falla con 1', () => {
    const p = proyecto();
    const r = correr(['escena', 'demo', 'intro'], p);
    expect(r.codigo).toBe(0);
    expect(r.out).toEqual(['creado videos/demo/theme.ts', 'creado videos/demo/intro (id de video: demo-intro)', 'ya se descubre solo (npm run render -- --list); no hay que registrarla']);
    const index = readFileSync(join(p, 'videos', 'demo', 'intro', 'index.ts'), 'utf8');
    expect(index).toContain('id: "demo-intro"');
    expect(index).toContain('from "../../../engine"');
    expect(readFileSync(join(p, 'videos', 'demo', 'theme.ts'), 'utf8')).toContain('from "../../themes"');
    expect(correr(['escena', 'demo', 'intro'], p)).toMatchObject({ codigo: 1, err: ['Ya existe videos/demo/intro'] });
  });

  it('la historia pide la escena primero y después apunta a ella', () => {
    const p = proyecto();
    expect(correr(['historia', 'demo', 'intro'], p)).toMatchObject({ codigo: 1, err: ['Primero crea la escena: npm run nuevo -- escena demo intro'] });
    correr(['escena', 'demo', 'intro'], p);
    const r = correr(['historia', 'demo', 'intro'], p);
    expect(r.codigo).toBe(0);
    expect(r.out[0]).toBe('creado videos/demo/historia (id de video: demo)');
    const index = readFileSync(join(p, 'videos', 'demo', 'historia', 'index.ts'), 'utf8');
    expect(index).toContain('"../intro/Scene"');
    expect(index).toContain('id: "demo"');
    expect(index).toContain('from "../../../stories"');
  });

  it('con VE_VIDEOS_DIR escribe afuera con alias y prepara tsconfig.json y env.d.ts', () => {
    const p = proyecto();
    const ext = carpeta('ve-nuevo-ext-');
    const r = correr(['escena', 'demo', 'uno'], p, { VE_VIDEOS_DIR: ext });
    expect(r.codigo).toBe(0);
    const tsconfig = readFileSync(join(ext, 'tsconfig.json'), 'utf8');
    expect(tsconfig).not.toContain('__REPO__');
    expect(tsconfig).toContain(conBarras(p));
    expect(readFileSync(join(ext, 'demo', 'uno', 'index.ts'), 'utf8')).toContain('"video-estudio/engine"');
    expect(readFileSync(join(ext, 'demo', 'theme.ts'), 'utf8')).toContain('"video-estudio/themes"');
    expect(r.out.at(-1)).toContain(`VE_VIDEOS_DIR=${ext} npm run render -- --list`);
    const solo = carpeta('ve-nuevo-ext2-');
    const e = correr(['externo'], p, { VE_VIDEOS_DIR: join(solo, 'nueva') });
    expect(e.out.at(-1)).toBe(`revision de tipos: VE_VIDEOS_DIR=${join(solo, 'nueva')} npm run typecheck`);
    expect(readdirSync(join(solo, 'nueva')).sort()).toEqual(['env.d.ts', 'tsconfig.json']);
  });

  it('el comando por línea de comandos anda con `node templates/nuevo.mjs`', () => {
    const p = proyecto();
    const r = spawnSync(process.execPath, [join(p, 'templates', 'nuevo.mjs'), 'escena', 'demo', 'cli'], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('creado videos/demo/cli (id de video: demo-cli)');
    expect(spawnSync(process.execPath, [join(p, 'templates', 'nuevo.mjs')], { encoding: 'utf8' }).status).toBe(2);
  });
});

const hayBash = (() => {
  if (process.platform === 'win32') return false; // en Windows `bash` puede ser el lanzador de WSL: la equivalencia se prueba donde hay bash de verdad
  try {
    execFileSync('bash', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hayBash)('templates/nuevo.mjs equivale a templates/nuevo.sh', () => {
  it('genera los mismos archivos y los mismos mensajes (dentro y fuera del repo)', () => {
    const a = proyecto(); // con .mjs
    const b = proyecto(); // con .sh
    const exA = carpeta('ve-eq-a-');
    const exB = carpeta('ve-eq-b-');
    const pasos: Array<[string[], boolean]> = [
      [['escena', 'eq', 'uno'], false],
      [['historia', 'eq', 'uno'], false],
      [['escena', 'eq', 'uno'], false], // ya existe
      [['escena', 'EQ', 'uno'], false], // slug inválido
      [['escena', 'eq'], false], // uso
      [['escena', 'ext', 'dos'], true],
      [['externo'], true],
    ];
    for (const [args, externo] of pasos) {
      const envA = { ...process.env, ...(externo ? { VE_VIDEOS_DIR: exA } : { VE_VIDEOS_DIR: '' }) };
      const envB = { ...process.env, ...(externo ? { VE_VIDEOS_DIR: exB } : { VE_VIDEOS_DIR: '' }) };
      const ra = spawnSync(process.execPath, [join(a, 'templates', 'nuevo.mjs'), ...args], { env: envA, encoding: 'utf8' });
      const rb = spawnSync('bash', [join(b, 'templates', 'nuevo.sh'), ...args], { env: envB, encoding: 'utf8' });
      // el único texto que cambia a propósito es cómo se nombra el comando
      const norm = (s: string, p: string, ex: string) => s.split(p).join('<P>').split(ex).join('<X>').split('npm run nuevo --').join('<CMD>').split('bash templates/nuevo.sh').join('<CMD>');
      expect(ra.status, args.join(' ')).toBe(rb.status);
      expect(norm(ra.stdout, a, exA), args.join(' ')).toBe(norm(rb.stdout, b, exB));
      expect(norm(ra.stderr, a, exA), args.join(' ')).toBe(norm(rb.stderr, b, exB));
    }
    for (const [x, y] of [[a, b], [exA, exB]] as const) {
      const ar = (d: string) => archivos(d).filter((f) => !relative(d, f).startsWith('templates')).map((f) => [relative(d, f), readFileSync(f, 'utf8').split(d).join('<P>').split(a).join('<R>').split(b).join('<R>')]);
      expect(ar(x)).toEqual(ar(y));
    }
  });
});
