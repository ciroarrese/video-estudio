// Configuración local del clon: `.video-studio.local.json` en la raíz del repo (ignorado por git).
//
// Guarda las carpetas que de otro modo habría que pasar en cada comando como variable de entorno:
//   { "videosDir": "~/mis-videos", "outDir": "...", "cacheDir": "..." }
// y se traducen a VE_VIDEOS_DIR, VE_OUT_DIR y VE_CACHE_DIR. La variable de entorno SIEMPRE gana: el archivo solo se lee
// cuando la variable no está definida (o está vacía). Una ruta relativa cuelga de la raíz del clon; `~` es la carpeta personal.
//
// Es JavaScript plano (sin TypeScript) para que lo usen igual `render/dirs.ts` (que todos los comandos importan), el doctor y
// `templates/nuevo.mjs`, que corren con Node solo. Las pruebas están en render/configlocal.test.ts.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NOMBRE_CONFIG_LOCAL = '.video-studio.local.json';

/** clave del archivo -> variable de entorno equivalente */
export const CLAVES_CONFIG_LOCAL = { videosDir: 'VE_VIDEOS_DIR', outDir: 'VE_OUT_DIR', cacheDir: 'VE_CACHE_DIR' };

const raizDelClon = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Ruta absoluta de un valor del archivo: `~` o `~/x` = carpeta personal; relativa = desde la raíz del clon. */
export function rutaDeConfig(valor, raiz = raizDelClon) {
  const v = String(valor).trim();
  if (v === '~') return homedir();
  if (/^~[\\/]/.test(v)) return join(homedir(), v.slice(2));
  return isAbsolute(v) ? resolve(v) : resolve(raiz, v);
}

/**
 * Lee `<raiz>/.video-studio.local.json` (o el archivo de VE_CONFIG_LOCAL). Devuelve `null` si no existe; si existe y está mal (JSON roto, clave desconocida, valor que no
 * es texto) lanza un Error en español que nombra el archivo: callar un error acá mandaría los videos a otra carpeta sin avisar.
 */
export function leerConfigLocal(raiz = raizDelClon, env = process.env) {
  // VE_CONFIG_LOCAL=<archivo> apunta a otro archivo (otra configuración, o pruebas); sus rutas relativas cuelgan de su carpeta.
  const archivo = env.VE_CONFIG_LOCAL ? resolve(env.VE_CONFIG_LOCAL) : join(raiz, NOMBRE_CONFIG_LOCAL);
  if (!existsSync(archivo)) return null;
  raiz = dirname(archivo);
  let datos;
  try {
    datos = JSON.parse(readFileSync(archivo, 'utf8'));
  } catch (e) {
    throw new Error(`${archivo} no es JSON válido: ${e.message}`);
  }
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) throw new Error(`${archivo} tiene que ser un objeto JSON, por ejemplo {"videosDir": "/ruta/a/mis-videos"}`);
  const valores = {};
  for (const [k, v] of Object.entries(datos)) {
    if (!(k in CLAVES_CONFIG_LOCAL)) throw new Error(`${archivo}: la clave "${k}" no existe. Las claves son: ${Object.keys(CLAVES_CONFIG_LOCAL).join(', ')}.`);
    if (typeof v !== 'string') throw new Error(`${archivo}: "${k}" tiene que ser un texto con una ruta (recibido ${JSON.stringify(v)}).`);
    if (v.trim() !== '') valores[k] = rutaDeConfig(v, raiz);
  }
  return { archivo, valores };
}

/**
 * De dónde sale cada carpeta, sin modificar nada: `{ VE_VIDEOS_DIR: { valor, origen }, ... }` con `origen` = `'variable de entorno'`,
 * `'<archivo>'` o `null` si no está definida. La variable de entorno gana sobre el archivo.
 */
export function resolverConfig(env = process.env, raiz = raizDelClon) {
  const cfg = leerConfigLocal(raiz, env);
  const res = {};
  for (const [clave, variable] of Object.entries(CLAVES_CONFIG_LOCAL)) {
    if (env[variable]) res[variable] = { valor: env[variable], origen: 'variable de entorno' };
    else if (cfg?.valores[clave]) res[variable] = { valor: cfg.valores[clave], origen: cfg.archivo };
    else res[variable] = { valor: null, origen: null };
  }
  return res;
}

/**
 * Completa en `env` (por defecto `process.env`) las variables que el archivo define y la persona no. Devuelve las que puso.
 * Idempotente. Los comandos la llaman por `render/dirs.ts`; no la llames desde una prueba sin pasarle un `env` propio.
 */
export function aplicarConfigLocal(env = process.env, raiz = raizDelClon) {
  const puestas = {};
  for (const [variable, { valor, origen }] of Object.entries(resolverConfig(env, raiz))) {
    if (valor && origen !== 'variable de entorno') {
      env[variable] = valor;
      puestas[variable] = valor;
    }
  }
  return puestas;
}
