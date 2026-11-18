// @vitest-environment node
// Configuración local (.video-studio.local.json): la variable de entorno manda; el archivo solo completa lo que falta.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aplicarConfigLocal, leerConfigLocal, NOMBRE_CONFIG_LOCAL, resolverConfig, rutaDeConfig } from './config-local.mjs';
import { comprobarVideosDir } from './doctor.mjs';

let raiz: string;
const escribir = (obj: unknown) => writeFileSync(join(raiz, NOMBRE_CONFIG_LOCAL), typeof obj === 'string' ? obj : JSON.stringify(obj));
beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 've-cfg-'));
});
afterEach(() => rmSync(raiz, { recursive: true, force: true }));

describe('leerConfigLocal / resolverConfig', () => {
  it('sin archivo no hay configuración', () => {
    expect(leerConfigLocal(raiz, {})).toBeNull();
    expect(resolverConfig({}, raiz).VE_VIDEOS_DIR).toEqual({ valor: null, origen: null });
  });

  it('con archivo y sin variable, el archivo define la carpeta; el origen es el archivo', () => {
    escribir({ videosDir: join(raiz, 'mis-videos'), outDir: 'salidas', cacheDir: '~/cache-ve' });
    const r = resolverConfig({}, raiz);
    expect(r.VE_VIDEOS_DIR).toEqual({ valor: join(raiz, 'mis-videos'), origen: join(raiz, NOMBRE_CONFIG_LOCAL) });
    expect(r.VE_OUT_DIR.valor).toBe(join(raiz, 'salidas')); // relativa: cuelga de la carpeta del archivo
    expect(r.VE_CACHE_DIR.valor).toBe(join(homedir(), 'cache-ve'));
  });

  it('la variable de entorno SIEMPRE gana; una variable vacía cuenta como no definida', () => {
    escribir({ videosDir: '/del/archivo' });
    const r = resolverConfig({ VE_VIDEOS_DIR: '/de/la/variable' }, raiz);
    expect(r.VE_VIDEOS_DIR).toEqual({ valor: '/de/la/variable', origen: 'variable de entorno' });
    expect(resolverConfig({ VE_VIDEOS_DIR: '' }, raiz).VE_VIDEOS_DIR.valor).toBe(resolve('/del/archivo'));
  });

  it('aplicarConfigLocal completa solo lo que falta y devuelve lo que puso', () => {
    escribir({ videosDir: '/del/archivo', outDir: '/salidas' });
    const env: Record<string, string | undefined> = { VE_OUT_DIR: '/mia' };
    expect(aplicarConfigLocal(env, raiz)).toEqual({ VE_VIDEOS_DIR: resolve('/del/archivo') });
    expect(env).toEqual({ VE_OUT_DIR: '/mia', VE_VIDEOS_DIR: resolve('/del/archivo') });
    expect(aplicarConfigLocal(env, raiz)).toEqual({}); // idempotente
  });

  it('VE_CONFIG_LOCAL apunta a otro archivo', () => {
    const otro = join(raiz, 'otra', 'cfg.json');
    mkdirSync(join(raiz, 'otra'));
    writeFileSync(otro, JSON.stringify({ videosDir: 'v' }));
    expect(resolverConfig({ VE_CONFIG_LOCAL: otro }, raiz).VE_VIDEOS_DIR.valor).toBe(join(raiz, 'otra', 'v'));
  });

  it('un archivo mal hecho es un error claro, no se ignora', () => {
    escribir('{no es json');
    expect(() => leerConfigLocal(raiz, {})).toThrow(/no es JSON válido/);
    escribir('[1]');
    expect(() => leerConfigLocal(raiz, {})).toThrow(/objeto JSON/);
    escribir({ videoDir: '/x' });
    expect(() => leerConfigLocal(raiz, {})).toThrow(/la clave "videoDir" no existe.*videosDir/);
    escribir({ videosDir: 3 });
    expect(() => leerConfigLocal(raiz, {})).toThrow(/tiene que ser un texto/);
    escribir({ videosDir: '  ' });
    expect(leerConfigLocal(raiz, {})!.valores).toEqual({}); // vacío = no definido
  });

  it('rutaDeConfig: ~, relativa y absoluta', () => {
    expect(rutaDeConfig('~', '/r')).toBe(homedir());
    expect(rutaDeConfig('~/x', '/r')).toBe(join(homedir(), 'x'));
    expect(rutaDeConfig('a/b', '/r')).toBe(resolve('/r', 'a/b'));
    expect(rutaDeConfig('/abs', '/r')).toBe(resolve('/abs'));
  });
});

describe('npm run doctor: de dónde sale la carpeta de videos', () => {
  it('dice si viene de la variable, del archivo o del clon', () => {
    const carpeta = join(raiz, 'videos-ext');
    mkdirSync(carpeta);
    escribir({ videosDir: carpeta });
    const delArchivo = comprobarVideosDir(resolverConfig({}, raiz));
    expect(delArchivo).toMatchObject({ estado: 'ok' });
    expect(delArchivo.detalle).toContain(`desde ${NOMBRE_CONFIG_LOCAL}, clave videosDir`);
    const deLaVariable = comprobarVideosDir(resolverConfig({ VE_VIDEOS_DIR: carpeta }, raiz));
    expect(deLaVariable.detalle).toContain('desde VE_VIDEOS_DIR');
    rmSync(join(raiz, NOMBRE_CONFIG_LOCAL));
    expect(comprobarVideosDir(resolverConfig({}, raiz)).detalle).toContain('videos/ del clon');
    escribir({ videosDir: join(raiz, 'no-existe') });
    expect(comprobarVideosDir(resolverConfig({}, raiz))).toMatchObject({ estado: 'falta' });
  });
});

describe('los comandos leen la configuración al pasar por render/dirs.ts', () => {
  const tsx = (() => {
    try {
      return createRequire(import.meta.url).resolve('tsx/cli');
    } catch {
      return null;
    }
  })();
  const correr = (env: Record<string, string>) => {
    const script = join(raiz, 'ver.ts');
    writeFileSync(script, `import { videosDirExterna, outDirPorDefecto, cacheDirPorDefecto } from ${JSON.stringify(join(__dirname, 'dirs.ts'))};\nconsole.log(JSON.stringify([videosDirExterna(), outDirPorDefecto(), cacheDirPorDefecto('/clon')]));\n`);
    const e = { ...process.env, ...env } as NodeJS.ProcessEnv;
    for (const k of ['VITEST', 'VE_VIDEOS_DIR', 'VE_OUT_DIR', 'VE_CACHE_DIR', 'VE_SIN_CONFIG_LOCAL']) if (!(k in env)) delete e[k];
    const r = spawnSync(process.execPath, [tsx!, script], { encoding: 'utf8', env: e });
    return { ...r, valor: r.status === 0 ? (JSON.parse(r.stdout) as (string | null)[]) : null };
  };

  it.skipIf(!tsx)('con archivo y sin variable manda el archivo; con variable manda la variable; un archivo roto corta con código 2', () => {
    const cfg = join(raiz, 'cfg.json');
    writeFileSync(cfg, JSON.stringify({ videosDir: join(raiz, 'v-archivo') }));
    expect(correr({ VE_CONFIG_LOCAL: cfg }).valor).toEqual([join(raiz, 'v-archivo'), join(raiz, 'v-archivo', 'out'), join(raiz, 'v-archivo', '.ve-cache')]);
    expect(correr({ VE_CONFIG_LOCAL: cfg, VE_VIDEOS_DIR: join(raiz, 'v-variable') }).valor?.[0]).toBe(join(raiz, 'v-variable'));
    expect(correr({ VE_CONFIG_LOCAL: cfg, VE_SIN_CONFIG_LOCAL: '1' }).valor?.[0]).toBeNull();
    writeFileSync(cfg, '{roto');
    const roto = correr({ VE_CONFIG_LOCAL: cfg });
    expect(roto.status).toBe(2);
    expect(roto.stderr).toContain('no es JSON válido');
  }, 60_000);
});
