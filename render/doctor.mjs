#!/usr/bin/env node
// Diagnóstico de la instalación: `npm run doctor`.
// Comprueba Node, node_modules, playwright y Chromium (lo lanza de verdad), ffmpeg y ffprobe, carpetas de salida y caché
// y que el motor descubre videos. Sin dependencias: corre con Node solo, aun antes de `npm install`.
// Código de salida: 0 si no falta nada imprescindible, 1 si falta algo, 2 si se pide una opción que no existe.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, rmSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- funciones puras (con prueba en doctor.test.ts) ----------

/** Extrae el número mayor mínimo de un rango de `engines.node` como ">=22" o ">=22.0.0". Devuelve null si no lo entiende. */
export function nodeMinimoDe(rango) {
  const m = /^\s*>=\s*v?(\d+)/.exec(String(rango ?? ''));
  return m ? Number(m[1]) : null;
}

/** ¿`version` ("v22.4.1" o "22.4.1") cumple el mínimo de versión mayor? */
export function cumpleNode(version, minimo) {
  const m = /^v?(\d+)\./.exec(String(version ?? ''));
  return !!m && Number(m[1]) >= minimo;
}

/** Primera línea de `ffmpeg -version` / `ffprobe -version` -> "6.1.1-3ubuntu5" (o null). */
export function versionDeFfmpeg(salida) {
  const m = /^\s*ff(?:mpeg|probe) version\s+(\S+)/im.exec(String(salida ?? ''));
  return m ? m[1] : null;
}

/** ¿La salida de `ffmpeg -encoders` trae el codificador (libx264, aac)? */
export function tieneCodificador(salida, nombre) {
  return new RegExp(`^\\s*[VAS][.A-Z]{5}\\s+${nombre}(\\s|$)`, 'm').test(String(salida ?? ''));
}

/** Bytes -> "12,3 GB" (coma decimal). */
export function formatearBytes(n) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${i === 0 ? String(Math.round(v)) : v.toFixed(1).replace('.', ',')} ${u[i]}`;
}

/** Carpetas donde se escribe, según las variables de entorno (misma regla que render/dirs.ts). */
export function carpetasDeSalida(env, raizRepo, cwd) {
  const ext = env.VE_VIDEOS_DIR ? resolve(env.VE_VIDEOS_DIR) : null;
  return {
    videosExterna: ext,
    cache: env.VE_CACHE_DIR ? resolve(env.VE_CACHE_DIR) : ext ? join(ext, '.ve-cache') : join(raizRepo, '.ve-cache'),
    salida: env.VE_OUT_DIR ? resolve(env.VE_OUT_DIR) : ext ? join(ext, 'out') : resolve(cwd, 'out'),
  };
}

/** Una línea de informe. estado: 'ok' | 'falta' | 'aviso'. */
export function lineaDeInforme(r) {
  const marca = r.estado === 'ok' ? 'OK    ' : r.estado === 'aviso' ? 'AVISO ' : 'FALTA ';
  let s = `${marca} ${r.nombre}${r.detalle ? `: ${r.detalle}` : ''}`;
  if (r.estado !== 'ok' && r.arreglo) s += `\n         -> ${r.arreglo}`;
  return s;
}

/** Código de salida: 1 si algún resultado imprescindible falta. */
export function codigoDeSalida(resultados) {
  return resultados.some((r) => r.estado === 'falta') ? 1 : 0;
}

// ---------- comprobaciones (tocan el sistema) ----------

const ok = (nombre, detalle) => ({ nombre, estado: 'ok', detalle });
const falta = (nombre, detalle, arreglo) => ({ nombre, estado: 'falta', detalle, arreglo });
const aviso = (nombre, detalle, arreglo) => ({ nombre, estado: 'aviso', detalle, arreglo });

function comprobarNode() {
  let minimo = 22;
  try {
    const pkg = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
    minimo = nodeMinimoDe(pkg.engines?.node) ?? minimo;
  } catch { /* se usa el mínimo por defecto */ }
  return cumpleNode(process.version, minimo)
    ? ok('Node', `${process.version} (se pide ${minimo} o superior)`)
    : falta('Node', `${process.version}; se pide ${minimo} o superior`, `Instalá Node ${minimo} o superior (https://nodejs.org o un gestor de versiones como nvm/fnm) y volvé a abrir la terminal.`);
}

function comprobarModulos() {
  if (existsSync(join(raiz, 'node_modules', 'react')) && existsSync(join(raiz, 'node_modules', 'tsx'))) return ok('Dependencias (node_modules)', 'instaladas');
  return falta('Dependencias (node_modules)', 'no están instaladas', `Corré "npm install" en ${raiz}.`);
}

async function cargarPlaywright() {
  const nombre = 'playwright';
  try {
    return await import(nombre);
  } catch { /* se prueba con require (NODE_PATH, instalaciones globales) */ }
  try {
    const m = createRequire(import.meta.url)(nombre);
    return m.chromium ? m : m.default;
  } catch {
    return null;
  }
}

async function comprobarChromium() {
  const pw = await cargarPlaywright();
  const exe = process.env.VE_CHROMIUM || undefined;
  if (!pw) {
    return [falta('Paquete playwright', 'no se encuentra', 'Corré "npm install" (y después "npx playwright install chromium", salvo que uses VE_CHROMIUM).')];
  }
  const chromium = pw.chromium ?? pw.default?.chromium;
  const res = [ok('Paquete playwright', 'presente')];
  if (exe && !existsSync(exe)) {
    res.push(falta('Chromium', `VE_CHROMIUM apunta a ${exe}, que no existe`, 'Corregí la ruta de VE_CHROMIUM o quitá la variable y corré "npx playwright install chromium".'));
    return res;
  }
  try {
    const b = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--hide-scrollbars'] });
    const v = b.version();
    await b.close();
    res.push(ok('Chromium', `se lanzó y cerró bien (versión ${v}${exe ? `, VE_CHROMIUM=${exe}` : ''})`));
  } catch (e) {
    const primera = String(e?.message ?? e).split('\n')[0];
    res.push(falta('Chromium', `no se pudo lanzar: ${primera}`,
      exe ? 'Revisá que VE_CHROMIUM sea un Chrome o Chromium ejecutable (en Linux puede faltar una biblioteca: "npx playwright install-deps chromium").'
        : 'Corré "npx playwright install chromium" (en Linux, si falta una biblioteca: "npx playwright install-deps chromium"), o apuntá VE_CHROMIUM a un Chrome o Chromium instalado.'));
  }
  return res;
}

function comprobarFfmpeg(prog) {
  const r = spawnSync(prog, ['-version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    return [falta(prog, 'no está en el PATH', `Instalá ffmpeg (incluye ffprobe): macOS "brew install ffmpeg", Debian/Ubuntu "sudo apt install ffmpeg", Windows "winget install Gyan.FFmpeg" o "choco install ffmpeg"; después abrí una terminal nueva y probá "${prog} -version". Ver docs/instalacion.md.`)];
  }
  const res = [ok(prog, `versión ${versionDeFfmpeg(r.stdout) ?? 'desconocida'}`)];
  if (prog === 'ffmpeg') {
    const e = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
    for (const [cod, para] of [['libx264', 'el video H.264'], ['aac', 'el audio']]) {
      if (!tieneCodificador(e.stdout, cod)) {
        res.push(falta(`ffmpeg con ${cod}`, `esta compilación no trae el codificador ${cod}, que hace falta para ${para}`, 'Instalá una compilación completa de ffmpeg (la de brew, apt, winget o chocolatey la trae).'));
      }
    }
  }
  return res;
}

function comprobarEscritura(nombre, dir, variable) {
  const arreglo = `Elegí una carpeta donde puedas escribir (${variable}=/ruta) o corregí los permisos de ${dir}.`;
  try {
    mkdirSync(dir, { recursive: true });
    const prueba = join(dir, `.doctor-${process.pid}.tmp`);
    writeFileSync(prueba, 'ok');
    rmSync(prueba, { force: true });
  } catch (e) {
    return falta(nombre, `no se puede escribir en ${dir} (${e?.code ?? e?.message})`, arreglo);
  }
  let libre = '';
  try {
    const s = statfsSync(dir);
    const bytes = Number(s.bavail) * Number(s.bsize);
    libre = `, ${formatearBytes(bytes)} libres`;
    if (bytes < 2 * 1024 ** 3) {
      return aviso(nombre, `${dir}${libre}`, 'Queda poco lugar: un video de un minuto puede pedir más de 1 GB entre caché y salidas. Liberá espacio o usá "npm run clean".');
    }
  } catch { /* statfs no disponible: se omite el dato */ }
  return ok(nombre, `${dir}${libre}`);
}

function comprobarVideosDir() {
  const ext = process.env.VE_VIDEOS_DIR;
  if (!ext) return null;
  const dir = resolve(ext);
  try {
    if (!statSync(dir).isDirectory()) throw new Error('no es una carpeta');
    accessSync(dir, constants.R_OK | constants.W_OK);
    return ok('Carpeta de videos (VE_VIDEOS_DIR)', dir);
  } catch (e) {
    return falta('Carpeta de videos (VE_VIDEOS_DIR)', `${dir}: ${e?.code === 'ENOENT' ? 'no existe' : e?.message}`, 'Creá la carpeta (en Windows, con el Explorador o "mkdir") o corregí la variable.');
  }
}

function comprobarDescubrimiento() {
  let tsx;
  try {
    tsx = createRequire(import.meta.url).resolve('tsx/cli');
  } catch {
    return falta('Descubrimiento de videos', 'no se pudo probar (falta tsx)', 'Corré "npm install" y repetí "npm run doctor".');
  }
  const r = spawnSync(process.execPath, [tsx, join(raiz, 'render', 'cli.ts'), '--list'], { cwd: raiz, encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) {
    const msg = `${r.stderr || ''}${r.stdout || ''}`.trim().split('\n').slice(0, 2).join(' | ');
    return falta('Descubrimiento de videos', `"npm run render -- --list" falló: ${msg || (r.error ? r.error.message : 'sin salida')}`, 'Revisá los avisos de Chromium y de las dependencias de arriba y corré "npm run render -- --list" para ver el error completo.');
  }
  const lineas = r.stdout.split('\n').filter((l) => /^\S+\s+\d+x\d+@\d+/.test(l));
  if (!lineas.some((l) => l.startsWith('hello '))) {
    return falta('Descubrimiento de videos', 'el motor arrancó pero no lista el ejemplo "hello"', 'Verificá que examples/ esté completo (¿clon o ZIP incompleto?; "git status" lo dice).');
  }
  return ok('Descubrimiento de videos', `el motor lista ${lineas.length} videos (incluye "hello")`);
}

/** Corre todas las comprobaciones y devuelve la lista de resultados. */
export async function diagnosticar(opciones = {}) {
  const res = [];
  res.push(comprobarNode());
  const modulos = comprobarModulos();
  res.push(modulos);
  res.push(...(await comprobarChromium()));
  res.push(...comprobarFfmpeg('ffmpeg'));
  res.push(...comprobarFfmpeg('ffprobe'));
  const c = carpetasDeSalida(process.env, raiz, process.cwd());
  res.push(comprobarEscritura('Carpeta de salidas', c.salida, 'VE_OUT_DIR'));
  res.push(comprobarEscritura('Carpeta de caché', c.cache, 'VE_CACHE_DIR'));
  const v = comprobarVideosDir();
  if (v) res.push(v);
  if (opciones.rapido) res.push(aviso('Descubrimiento de videos', 'omitido (--rapido)'));
  else if (res.some((r) => r.estado === 'falta')) {
    res.push(aviso('Descubrimiento de videos', 'omitido: antes hay que arreglar lo de arriba'));
  } else res.push(comprobarDescubrimiento());
  return res;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    console.log('Uso: npm run doctor [-- --rapido]\n\nComprueba Node, dependencias, Chromium, ffmpeg, carpetas de salida y que el motor descubre videos.\n--rapido omite la prueba de descubrimiento (la más lenta).');
    return 0;
  }
  const desconocidas = args.filter((a) => a !== '--rapido');
  if (desconocidas.length) { console.error(`Opción desconocida: ${desconocidas[0]}. Probá --help.`); return 2; }
  console.log('Video Studio: diagnóstico de la instalación\n');
  const res = await diagnosticar({ rapido: args.includes('--rapido') });
  for (const r of res) console.log(lineaDeInforme(r));
  const codigo = codigoDeSalida(res);
  console.log(codigo === 0 ? '\nTodo lo imprescindible está en orden.' : '\nFalta algo imprescindible: arreglalo con las indicaciones de arriba y volvé a correr "npm run doctor".');
  return codigo;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(await main());
}
