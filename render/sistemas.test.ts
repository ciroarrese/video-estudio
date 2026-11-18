// @vitest-environment node
// `npm run sistemas` (render/sistemas.ts, render/sistemas-cli.ts): la convención de design system instalado, en carpetas temporales.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { esSistemaInstalado, formatoSistemas, listarSistemas, reexportaSistema, tieneVideo } from './sistemas';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporales: string[] = [];
const carpeta = () => {
  const d = mkdtempSync(join(tmpdir(), 've-sistemas-'));
  temporales.push(d);
  return d;
};
afterAll(() => temporales.forEach((d) => rmSync(d, { recursive: true, force: true })));

const escribir = (base: string, ruta: string, texto = 'x') => {
  const f = join(base, ruta);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, texto);
};

/** Una carpeta de videos con un sistema ficticio completo, su video de ejemplo y un video que lo usa. */
const conSistema = (nombre = 'marca-demo') => {
  const d = carpeta();
  escribir(d, `${nombre}/theme.ts`, 'export const theme = {};\nexport const report = {};\n');
  escribir(d, `${nombre}/README.md`, '# marca-demo');
  escribir(d, `${nombre}/Intro.tsx`);
  escribir(d, `${nombre}/Cierre.tsx`);
  escribir(d, `assets/${nombre}/fuente.woff2`);
  escribir(d, `${nombre}-base/theme.ts`, `export { theme, report } from "../${nombre}/theme";\n`);
  escribir(d, `${nombre}-base/escena/index.ts`, 'export {};');
  escribir(d, `mi-video/theme.ts`, `export { theme } from '../${nombre}/theme';\n`);
  escribir(d, `mi-video/index.ts`, 'export {};');
  escribir(d, `otro/theme.ts`, 'export const theme = {};\n');
  escribir(d, `otro/index.ts`, 'export {};');
  return d;
};

describe('convención de design system instalado', () => {
  it('lista el sistema con README, assets, ejemplo, piezas y los videos que lo reexportan', () => {
    const d = conSistema();
    const [s, ...resto] = listarSistemas(d);
    expect(resto).toEqual([]);
    expect(s).toEqual({
      nombre: 'marca-demo',
      ruta: join(d, 'marca-demo'),
      exportaReport: true,
      assets: join(d, 'assets', 'marca-demo'),
      ejemplo: 'marca-demo-base',
      piezas: ['Cierre.tsx', 'Intro.tsx'],
      videos: ['marca-demo-base', 'mi-video'],
    });
  });

  it('no son sistemas: videos con theme.ts y README, carpetas sin README, assets, out y ocultas', () => {
    const d = carpeta();
    escribir(d, 'video/theme.ts');
    escribir(d, 'video/README.md');
    escribir(d, 'video/index.ts');
    escribir(d, 'anidado/theme.ts');
    escribir(d, 'anidado/README.md');
    escribir(d, 'anidado/escena/index.tsx'); // un video en una subcarpeta también la vuelve video
    escribir(d, 'sin-readme/theme.ts');
    escribir(d, 'sin-tema/README.md');
    escribir(d, 'assets/theme.ts');
    escribir(d, 'assets/README.md');
    escribir(d, '.oculta/theme.ts');
    escribir(d, '.oculta/README.md');
    escribir(d, 'suelto.md');
    expect(listarSistemas(d)).toEqual([]);
    expect(esSistemaInstalado(join(d, 'video'))).toBe(false);
    expect(esSistemaInstalado(join(d, 'anidado'))).toBe(false);
    expect(tieneVideo(join(d, 'anidado'))).toBe(true);
    expect(tieneVideo(join(d, 'sin-readme'))).toBe(false);
  });

  it('el sistema puede no traer assets, ejemplo ni report; varios salen en orden alfabético', () => {
    const d = carpeta();
    escribir(d, 'zeta/theme.ts', 'export const theme = {};');
    escribir(d, 'zeta/README.md');
    escribir(d, 'alfa/theme.ts', 'export const theme = {};');
    escribir(d, 'alfa/README.md');
    const r = listarSistemas(d);
    expect(r.map((s) => s.nombre)).toEqual(['alfa', 'zeta']);
    expect(r[0]).toMatchObject({ exportaReport: false, assets: null, ejemplo: null, piezas: [], videos: [] });
  });

  it('una carpeta de videos que no existe da una lista vacía', () => {
    expect(listarSistemas(join(carpeta(), 'no-existe'))).toEqual([]);
  });

  it('reexportaSistema reconoce comillas, extensión y no confunde nombres que comparten el comienzo', () => {
    expect(reexportaSistema('export { theme } from "../marca-demo/theme";', 'marca-demo')).toBe(true);
    expect(reexportaSistema("export { theme } from '../marca-demo/theme.ts'", 'marca-demo')).toBe(true);
    expect(reexportaSistema('export { theme } from "../marca-demo-2/theme";', 'marca-demo')).toBe(false);
    expect(reexportaSistema('export const theme = 1;', 'marca-demo')).toBe(false);
  });

  it('el texto nombra el sistema y cómo usarlo; sin sistemas explica la convención', () => {
    const d = conSistema();
    const t = formatoSistemas(d, listarSistemas(d));
    expect(t).toContain('sistemas: 1 instalado');
    expect(t).toContain('marca-demo-base, mi-video');
    expect(t).toContain('--sistema marca-demo');
    const vacio = formatoSistemas(d, []);
    expect(vacio).toContain('sistemas: ninguno');
    expect(vacio).toContain('theme.ts y README.md');
  });
});

describe('npm run sistemas (por línea de comandos)', () => {
  const correr = (args: string[], env: Record<string, string>) =>
    spawnSync(process.execPath, ['--import', 'tsx', join(repo, 'render', 'sistemas-cli.ts'), ...args], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, VITEST: '', VE_SIN_CONFIG_LOCAL: '1', VE_VIDEOS_DIR: '', ...env },
    });

  it('respeta VE_VIDEOS_DIR: con sistema, con --json y sin ninguno', () => {
    const d = conSistema();
    const texto = correr([], { VE_VIDEOS_DIR: d });
    expect(texto.status).toBe(0);
    expect(texto.stdout).toContain('marca-demo');
    const json = JSON.parse(correr(['--json'], { VE_VIDEOS_DIR: d }).stdout);
    expect(json.carpeta).toBe(d);
    expect(json.sistemas[0].nombre).toBe('marca-demo');
    const vacia = correr([], { VE_VIDEOS_DIR: carpeta() });
    expect(vacia.status).toBe(0);
    expect(vacia.stdout).toContain('sistemas: ninguno');
    expect(correr(['--raro'], { VE_VIDEOS_DIR: d }).status).toBe(2);
  });

  it('lee la carpeta de .video-studio.local.json (VE_CONFIG_LOCAL) cuando la variable no está', () => {
    const d = conSistema();
    const cfg = join(carpeta(), 'config.json');
    writeFileSync(cfg, JSON.stringify({ videosDir: d }));
    const r = correr(['--json'], { VE_SIN_CONFIG_LOCAL: '', VE_CONFIG_LOCAL: cfg });
    expect(JSON.parse(r.stdout).sistemas[0].nombre).toBe('marca-demo');
  });
});
