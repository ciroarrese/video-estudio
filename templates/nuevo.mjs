#!/usr/bin/env node
// Crea archivos de un video a partir de las plantillas, con los imports ya corregidos. Es la única implementación
// (`templates/nuevo.sh` es un envoltorio que la llama) y corre igual en Windows (PowerShell o cmd), macOS y Linux.
//   npm run nuevo -- escena <slug> <nombre-de-escena>     -> videos/<slug>/<nombre-de-escena>/
//   npm run nuevo -- historia <slug> <escena-de-ejemplo>  -> videos/<slug>/historia/
//   npm run nuevo -- externo                              -> solo prepara tsconfig.json y env.d.ts de VE_VIDEOS_DIR
// También crea videos/<slug>/theme.ts (tema neutro) si todavía no existe.
// Con VE_VIDEOS_DIR definida (videos fuera del repo) escribe ahí en vez de en videos/, con los imports por alias
// (`video-estudio/engine`, ...) y crea tsconfig.json y env.d.ts de esa carpeta si faltan.
// No hay que registrar nada: el runtime descubre solo toda carpeta videos/<slug>/**/index.ts (ver SKILL.md).
// Código de salida: 0 bien, 1 el destino ya existe o falta algo previo, 2 uso incorrecto.
// Sin dependencias: corre con Node solo.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- funciones puras (con prueba en render/nuevo.test.ts) ----------

const NOMBRE_VALIDO = /^[a-z0-9][a-z0-9-]*$/;

/** ¿Sirve como slug o nombre de escena? Minúsculas, números y guiones; no empieza con guion. */
export const nombreValido = (s) => NOMBRE_VALIDO.test(String(s ?? ''));

/** Barras normales aun en Windows: las rutas que van dentro de archivos (tsconfig.json) no llevan barra invertida. */
export const conBarras = (ruta) => String(ruta).split('\\').join('/');

/** theme.ts: `"../themes"` pasa a `"<pref>themes"`. */
export const reescribirTema = (texto, pref) => texto.replace(/"\.\.\/themes"/g, () => `"${pref}themes"`);

/** Imports de una escena o historia: `"../../engine`, kit, themes, stories, fx, qa pasan a `"<pref><carpeta>`. */
export const reescribirImports = (texto, pref) => texto.replace(/"\.\.\/\.\.\/(engine|kit|themes|stories|fx|qa)/g, (_, d) => `"${pref}${d}`);

/** tsconfig.json de la carpeta externa: `__REPO__` pasa a la ruta del repo (con barras normales). */
export const reescribirTsconfig = (texto, repo) => texto.replace(/__REPO__/g, () => conBarras(repo));

/** index.ts de la escena: el id de la plantilla pasa a `<slug>-<nombre>`. */
export const indiceDeEscena = (texto, slug, nombre) => texto.replace('"plantilla-escena"', () => `"${slug}-${nombre}"`);

/** index.ts de la historia: apunta a la escena elegida y el id pasa a `<slug>`. */
export const indiceDeHistoria = (texto, slug, nombre) =>
  texto.replace('"../scene/Scene"', () => `"../${nombre}/Scene"`).replace('"plantilla-historia"', () => `"${slug}"`);

export const USO = [
  'Uso: npm run nuevo -- escena <slug> <nombre-de-escena>',
  '     npm run nuevo -- historia <slug> <nombre-de-una-escena>',
  '     npm run nuevo -- externo        (con VE_VIDEOS_DIR: prepara tsconfig.json y env.d.ts)',
];

// ---------- el programa ----------

class Salida extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

const reescribirArchivos = (dir, extensiones, f) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isFile() && extensiones.some((x) => e.name.endsWith(x))) {
      const ruta = join(dir, e.name);
      writeFileSync(ruta, f(readFileSync(ruta, 'utf8')));
    }
  }
};

/**
 * Corre el programa. `log` y `err` reciben una línea cada vez. Devuelve el código de salida.
 * `opciones.repo` cambia la raíz (para pruebas); `opciones.env` las variables (por defecto `process.env`).
 */
export function nuevo(args, log = console.log, err = console.error, opciones = {}) {
  const repo = opciones.repo ?? raiz;
  const env = opciones.env ?? process.env;
  const plantillas = join(repo, 'templates');
  try {
    const [modo = '', slug = '', nombre = ''] = args;

    // Carpeta externa: tsconfig.json con paths a este repo y env.d.ts (solo si faltan).
    const prepararExterno = (dir) => {
      mkdirSync(dir, { recursive: true });
      if (!existsSync(join(dir, 'tsconfig.json'))) {
        writeFileSync(join(dir, 'tsconfig.json'), reescribirTsconfig(readFileSync(join(plantillas, 'externo', 'tsconfig.json'), 'utf8'), repo));
        log(`creado ${conBarras(join(dir, 'tsconfig.json'))}`);
      }
      if (!existsSync(join(dir, 'env.d.ts'))) {
        cpSync(join(plantillas, 'externo', 'env.d.ts'), join(dir, 'env.d.ts'));
        log(`creado ${conBarras(join(dir, 'env.d.ts'))}`);
      }
    };

    if (modo === 'externo') {
      if (!env.VE_VIDEOS_DIR) throw new Salida(2, 'Falta VE_VIDEOS_DIR (la carpeta de videos fuera del repo).');
      const externa = resolve(env.VE_VIDEOS_DIR);
      prepararExterno(externa);
      log(`revision de tipos: VE_VIDEOS_DIR=${externa} npm run typecheck`);
      return 0;
    }
    if (!modo || !slug || !nombre || (modo !== 'escena' && modo !== 'historia')) {
      for (const l of USO) err(l);
      return 2;
    }
    if (!nombreValido(slug)) throw new Salida(2, 'El slug va en minusculas, numeros y guiones.');
    if (!nombreValido(nombre)) throw new Salida(2, 'El nombre va en minusculas, numeros y guiones.');

    let base;
    let basePublica; // cómo se nombra en los mensajes
    let prefTema;
    let prefNivel;
    if (env.VE_VIDEOS_DIR) {
      const externa = resolve(env.VE_VIDEOS_DIR);
      prepararExterno(externa);
      base = join(externa, slug);
      basePublica = conBarras(base);
      prefTema = 'video-estudio/'; // imports por alias: la carpeta de afuera no tiene engine/ al lado
      prefNivel = 'video-estudio/';
    } else {
      base = join(repo, 'videos', slug);
      basePublica = `videos/${slug}`;
      prefTema = '../../';
      prefNivel = '../../../';
    }
    mkdirSync(base, { recursive: true });
    if (!existsSync(join(base, 'theme.ts'))) {
      writeFileSync(join(base, 'theme.ts'), reescribirTema(readFileSync(join(plantillas, 'theme.ts'), 'utf8'), prefTema));
      log(`creado ${basePublica}/theme.ts`);
    }

    if (modo === 'escena') {
      const dest = join(base, nombre);
      if (existsSync(dest)) throw new Salida(1, `Ya existe ${basePublica}/${nombre}`);
      cpSync(join(plantillas, 'scene'), dest, { recursive: true });
      reescribirArchivos(dest, ['.ts', '.tsx'], (t) => reescribirImports(t, prefNivel));
      const indice = join(dest, 'index.ts');
      writeFileSync(indice, indiceDeEscena(readFileSync(indice, 'utf8'), slug, nombre));
      log(`creado ${basePublica}/${nombre} (id de video: ${slug}-${nombre})`);
      log(`ya se descubre solo (${env.VE_VIDEOS_DIR ? `VE_VIDEOS_DIR=${env.VE_VIDEOS_DIR} ` : ''}npm run render -- --list); no hay que registrarla`);
    } else {
      const dest = join(base, 'historia');
      if (existsSync(dest)) throw new Salida(1, `Ya existe ${basePublica}/historia`);
      if (!existsSync(join(base, nombre))) throw new Salida(1, `Primero crea la escena: npm run nuevo -- escena ${slug} ${nombre}`);
      cpSync(join(plantillas, 'story'), dest, { recursive: true });
      reescribirArchivos(dest, ['.ts'], (t) => reescribirImports(t, prefNivel));
      const indice = join(dest, 'index.ts');
      writeFileSync(indice, indiceDeHistoria(readFileSync(indice, 'utf8'), slug, nombre));
      log(`creado ${basePublica}/historia (id de video: ${slug})`);
      log('falta: reemplazar las dos escenas de ejemplo por las reales (la historia ya se descubre sola)');
    }
    return 0;
  } catch (e) {
    if (e instanceof Salida) {
      err(e.message);
      return e.codigo;
    }
    throw e;
  }
}

// ¿Corre este archivo como programa? `import.meta.url` ya viene con los enlaces simbólicos resueltos (macOS: /var -> /private/var),
// así que `argv[1]` se compara por su ruta real; si no, el comando no hace nada cuando la ruta pasa por un enlace.
const esPrincipal = () => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href;
  } catch {
    return false;
  }
};

if (esPrincipal()) {
  process.exit(nuevo(process.argv.slice(2)));
}
