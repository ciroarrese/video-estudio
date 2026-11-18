// Salidas viejas de un video (`npm run limpiar -- <slug|id>`): mp4, hojas de prueba y carpetas de cuadros que quedaron en la carpeta
// de salidas desde antes de la última modificación del código del video.
//
// Qué se considera "de ese video": los archivos de la carpeta de salidas cuyo nombre empieza con el id del video, con la forma que
// dejan los comandos: `<id>[-formato][-escena][-f<a>-<b>][-liviano].mp4`, `<id>[...]-sheet.png` y `<id>[...]-frames/`. Si hay un video
// con un id más largo que también empieza igual (`hola` y `hola-mundo`), el archivo es del más largo: nunca se borra lo de otro video.
// Qué se considera "más viejo que el código": su fecha es anterior a la del archivo más nuevo de la carpeta del video.
// Nunca se toca nada fuera de la carpeta de salidas (se comprueba por cada ruta antes de borrar).
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type CarpetaDeVideo = { slug: string; dir: string; ids: string[] };
export type Salida = { ruta: string; nombre: string; esCarpeta: boolean; bytes: number; mtimeMs: number };

const IGNORADAS = new Set(['node_modules', 'out']);
const esOculta = (n: string) => n.startsWith('.');

/** Todos los archivos bajo `dir` (sin carpetas ocultas, `node_modules` ni `out`). */
function archivos(dir: string, acc: string[] = [], profundidad = 0): string[] {
  if (profundidad > 8) return acc;
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entradas) {
    if (esOculta(e.name) || IGNORADAS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) archivos(p, acc, profundidad + 1);
    else if (e.isFile()) acc.push(p);
  }
  return acc;
}

/** Ids que declara el código de una carpeta: el primer `id:` de cada `defineVideo({...})` / `defineStory({...})`. Es una lectura del texto (heurística). */
export function idsDeCodigo(dir: string): string[] {
  const ids = new Set<string>();
  for (const f of archivos(dir)) {
    if (!/\.[cm]?[jt]sx?$/.test(f)) continue;
    let texto: string;
    try {
      texto = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const m of texto.matchAll(/define(?:Video|Story)\s*\(\s*\{[\s\S]{0,400}?\bid\s*:\s*(['"`])([\w.-]+)\1/g)) ids.add(m[2]!);
  }
  return [...ids].sort();
}

/** Carpetas de video: `<videos>/<slug>` (`videosDir` es la carpeta externa o `videos/` del clon) y `examples/<slug>`. */
export function carpetasDeVideo(raiz: string, videosDir: string | null): CarpetaDeVideo[] {
  const res: CarpetaDeVideo[] = [];
  for (const base of [videosDir ?? join(raiz, 'videos'), join(raiz, 'examples')]) {
    if (!existsSync(base)) continue;
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || esOculta(e.name) || IGNORADAS.has(e.name)) continue;
      const dir = join(base, e.name);
      res.push({ slug: e.name, dir, ids: idsDeCodigo(dir) });
    }
  }
  return res;
}

/** Id con que empieza `base` (`base === id` o `id-...`), el más largo de `ids`; `null` si ninguno. */
export function idDe(base: string, ids: Iterable<string>): string | null {
  let mejor: string | null = null;
  for (const id of ids) if ((base === id || base.startsWith(`${id}-`)) && (mejor === null || id.length > mejor.length)) mejor = id;
  return mejor;
}

/** Nombre del archivo de salida sin la terminación conocida (`.mp4`, `-liviano.mp4`, `-sheet.png`, `-frames/`), o `null` si no es una salida. */
export function baseDeSalida(nombre: string, esCarpeta: boolean): string | null {
  if (esCarpeta) return nombre.endsWith('-frames') ? nombre.slice(0, -'-frames'.length) : null;
  const m = /^(.*?)(?:-liviano)?(?:\.[0-9a-z-]+\.tmp)?\.mp4$/i.exec(nombre) ?? /^(.*)-sheet\.png$/i.exec(nombre);
  return m ? m[1]! : null;
}

const masNuevo = (archivosDe: string[]): number => archivosDe.reduce((m, f) => Math.max(m, statSync(f).mtimeMs), 0);

export type PlanDeLimpieza = {
  /** Ids con los que se buscaron las salidas. */
  ids: string[];
  /** Fecha (ms) del archivo más nuevo del código del video. */
  codigoMs: number;
  carpetas: CarpetaDeVideo[];
  /** Salidas del video más viejas que su código. */
  viejas: Salida[];
  /** Salidas del video que no son más viejas que el código (se conservan). */
  vigentes: Salida[];
};

/**
 * Arma el plan: qué salidas de `nombre` (slug o id) hay en `outDir` y cuáles son más viejas que su código. No borra nada.
 * Lanza si `nombre` no es ni la carpeta ni el id de ningún video.
 */
export function planearLimpieza(nombre: string, o: { raiz: string; videosDir: string | null; outDir: string }): PlanDeLimpieza {
  if (!/^[A-Za-z0-9][\w.-]*$/.test(nombre) || nombre.includes('..')) throw new Error(`"${nombre}" no es un slug ni un id de video (solo letras, números, guion, guion bajo y punto)`);
  const todas = carpetasDeVideo(o.raiz, o.videosDir);
  const carpetas = todas.filter((c) => c.slug === nombre || c.ids.includes(nombre));
  if (!carpetas.length) throw new Error(`no encontré un video con carpeta o id "${nombre}" en ${o.videosDir ?? join(o.raiz, 'videos')} ni en examples/. Carpetas: ${todas.map((c) => c.slug).join(', ') || '(ninguna)'}`);
  const ids = [...new Set([nombre, ...carpetas.flatMap((c) => c.ids)])];
  const ajenos = todas.filter((c) => !carpetas.includes(c)).flatMap((c) => [c.slug, ...c.ids]).filter((i) => !ids.includes(i));
  const conocidos = [...ids, ...ajenos];
  const codigoMs = masNuevo(carpetas.flatMap((c) => archivos(c.dir)));
  const viejas: Salida[] = [];
  const vigentes: Salida[] = [];
  if (existsSync(o.outDir)) {
    for (const e of readdirSync(o.outDir, { withFileTypes: true })) {
      const esCarpeta = e.isDirectory();
      if (!esCarpeta && !e.isFile()) continue;
      const base = baseDeSalida(e.name, esCarpeta);
      const dueno = base === null ? null : idDe(base, conocidos);
      if (dueno === null || !ids.includes(dueno)) continue;
      const ruta = join(o.outDir, e.name);
      const fs = archivos(ruta);
      const bytes = esCarpeta ? fs.reduce((t, f) => t + statSync(f).size, 0) : statSync(ruta).size;
      // la fecha de una carpeta cambia con cada archivo que se agrega o se borra: vale el archivo más nuevo de adentro (o la de la carpeta, si está vacía)
      const mtimeMs = esCarpeta && fs.length ? masNuevo(fs) : statSync(ruta).mtimeMs;
      (mtimeMs < codigoMs ? viejas : vigentes).push({ ruta, nombre: e.name, esCarpeta, bytes, mtimeMs });
    }
  }
  const porNombre = (a: Salida, b: Salida) => (a.nombre < b.nombre ? -1 : 1);
  return { ids, codigoMs, carpetas, viejas: viejas.sort(porNombre), vigentes: vigentes.sort(porNombre) };
}

/** ¿`ruta` está directamente dentro de `outDir` (sin salir por `..` ni por un enlace simbólico en el camino)? */
export function estaDentro(outDir: string, ruta: string): boolean {
  const r = resolve(ruta);
  const base = resolve(outDir);
  if (dirname(r) !== base) return false; // solo hijos directos: es lo único que se arma en planearLimpieza
  try {
    return realpathSync(dirname(r)) === realpathSync(base);
  } catch {
    return false;
  }
}

/** Borra las salidas dadas, comprobando una por una que estén dentro de `outDir`. Devuelve las que borró. Un enlace simbólico se borra como enlace (no su destino). */
export function borrarSalidas(salidas: readonly Salida[], outDir: string): Salida[] {
  const borradas: Salida[] = [];
  for (const s of salidas) {
    if (!estaDentro(outDir, s.ruta)) throw new Error(`no borro ${s.ruta}: está fuera de la carpeta de salidas (${outDir})`);
    if (!lstatSync(s.ruta, { throwIfNoEntry: false })) continue; // ya no está
    rmSync(s.ruta, { recursive: true, force: true });
    borradas.push(s);
  }
  return borradas;
}
