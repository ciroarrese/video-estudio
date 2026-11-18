// Estáticos que un render realmente pidió, y la validación de una parte en caché contra ellos.
//
// Antes la clave de cada parte incluía ruta+tamaño+fecha de TODOS los archivos de las carpetas de estáticos y `public/` entero:
// agregar un archivo suelto (una pista original, un intermedio) rehacía el video entero. Ahora la clave de la parte NO los incluye.
// En su lugar, junto a cada parte (`seg-<clave>.mp4`) se guarda `seg-<clave>.estaticos.json`: la lista de URLs que el servidor de
// estáticos sirvió durante el render (más a qué archivo y con qué contenido se resolvió cada una). Al reutilizar una parte, cada URL
// de esa lista se vuelve a resolver contra las carpetas de AHORA, con la misma prioridad que el servidor, y se compara:
//   - el contenido del archivo (hash, con la caché por tamaño+fecha de render/filehash.ts) -> "cambió el estático X";
//   - de qué archivo sale (un archivo nuevo en una carpeta de más prioridad tapa al anterior) -> también invalida;
//   - si no había (404) y ahora hay, o al revés.
// Un archivo que no se pidió no puede cambiar ningún cuadro, así que agregarlo no invalida. Una parte sin lista (caché vieja, o un
// render donde un estático cambió mientras se renderizaba) se rehace: nunca se acepta sin poder comprobarla.
//
// Lo que NO se sigue acá (ya lo cubre la huella del código del video, ver `videoCodeFiles` en render.ts):
//   - los archivos que genera el bundle (js, css, imágenes importadas: su contenido sale de los fuentes que entran a la huella);
//   - el audio (no cambia ningún cuadro; ver `esArchivoDeAudio`).
// Los estáticos de `public/` llegan al servidor como copia dentro del bundle; se siguen por el archivo de `public/`.
import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { esArchivoDeAudio } from './assets';
import type { FileHashCache } from './filehash';
import { fileInServido as fileIn } from './server';

export type EntradaEstatico = {
  /** Ruta pedida al servidor, tal como llegó (sin query, codificada), con `/` inicial. */
  url: string;
  /** `archivo`: sale de una carpeta de estáticos o de `public/` (se sigue su contenido); `bundle`: lo generó la compilación (lo cubre la huella del código; no se anota); `ninguno`: el servidor respondió 404. */
  tipo: 'archivo' | 'bundle' | 'ninguno';
  archivo?: string;
  hash?: string;
};

export type ManifiestoEstaticos = { version: 1; estaticos: EntradaEstatico[] };

/** Carpetas por las que se resuelve una URL, en el mismo orden de prioridad que el servidor: estáticos, bundle, `public/`. */
export type RaicesEstaticos = { assets: readonly string[]; bundleDir: string; publico: string };

export const sufijoManifiesto = '.estaticos.json';
/** `seg-<clave>.mp4` -> `seg-<clave>.estaticos.json` */
export const manifiestoDe = (parte: string): string => parte.replace(/\.mp4$/, sufijoManifiesto);

/** Qué archivo sirve hoy `url` y de qué clase es. Sin leer contenido. */
export function resolverEstatico(url: string, r: RaicesEstaticos): { tipo: EntradaEstatico['tipo']; archivo?: string } {
  for (const root of [...r.assets, r.bundleDir, r.publico]) {
    const f = fileIn(root, url);
    if (!f) continue;
    if (root === r.bundleDir) {
      // `public/` se copia dentro del bundle: lo que cuenta es el archivo de `public/`, no la copia
      const original = fileIn(r.publico, url);
      return original ? { tipo: 'archivo', archivo: original } : { tipo: 'bundle' };
    }
    return { tipo: 'archivo', archivo: f };
  }
  return { tipo: 'ninguno' };
}

const firma = (f: string): string | null => {
  try {
    const st = statSync(f, { bigint: true });
    return `${st.size}:${st.mtimeNs}:${st.ctimeNs}:${st.ino}`;
  } catch {
    return null;
  }
};

/**
 * Anota qué pidió el render. Se engancha al servidor (`serveStatic(..., { onPedido })`). Guarda, por URL, a qué archivo se resolvió y
 * su firma (tamaño, fechas, inodo) en el PRIMER pedido; si en otro pedido o al final la resolución o la firma son otras, el
 * archivo cambió mientras se renderizaba: no se puede saber con cuál contenido se dibujó cada cuadro, y no se guarda manifiesto.
 */
export class RegistroEstaticos {
  private vistos = new Map<string, { tipo: EntradaEstatico['tipo']; archivo?: string; firma: string | null }>();
  private inestable: string | null = null;
  constructor(private raices: () => RaicesEstaticos) {}

  /** Para `serveStatic`: se llama por cada pedido que no es la página del runtime. */
  registrar = (url: string): void => {
    const u = url.startsWith('/') ? url : `/${url}`;
    if (esArchivoDeAudio(u) || u === '/favicon.ico') return;
    let r: ReturnType<typeof resolverEstatico>;
    try {
      r = resolverEstatico(u, this.raices());
    } catch {
      return; // ruta mal codificada: el servidor responde 400 y no se usa
    }
    if (r.tipo === 'bundle') return; // lo que genera la compilación (js, css) tiene el hash en el nombre y lo cubre la huella del código
    const f = r.archivo ? firma(r.archivo) : null;
    const antes = this.vistos.get(u);
    if (!antes) this.vistos.set(u, { ...r, firma: f });
    else if (antes.tipo !== r.tipo || antes.archivo !== r.archivo || antes.firma !== f) this.inestable ??= u;
  };

  /** URLs pedidas hasta ahora (para pruebas y diagnóstico). */
  get urls(): string[] {
    return [...this.vistos.keys()].sort();
  }

  /**
   * Manifiesto de lo pedido hasta ahora, con el contenido de cada archivo, o `null` si algo cambió mientras se renderizaba.
   * Se llama cuando una parte ya tiene todos sus cuadros capturados: lo que pidió está incluido (y puede haber más, de otras partes:
   * es un conjunto mayor, así que solo puede invalidar de más, nunca de menos).
   */
  async instantanea(hashes: FileHashCache): Promise<ManifiestoEstaticos | null> {
    if (this.inestable) return null;
    const estaticos: EntradaEstatico[] = [];
    for (const [url, visto] of [...this.vistos].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const ahora = resolverEstatico(url, this.raices());
      if (ahora.tipo !== visto.tipo || ahora.archivo !== visto.archivo) return null;
      if (ahora.tipo === 'archivo') {
        if (firma(ahora.archivo!) !== visto.firma) return null;
        estaticos.push({ url, tipo: 'archivo', archivo: ahora.archivo, hash: await hashes.hashOf(ahora.archivo!) });
      } else estaticos.push({ url, tipo: ahora.tipo });
    }
    return { version: 1, estaticos };
  }
}

/** Escribe el manifiesto de forma atómica (primero el temporal, después el cambio de nombre). */
export function escribirManifiesto(archivo: string, m: ManifiestoEstaticos): void {
  const tmp = `${archivo}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(m));
  renameSync(tmp, archivo);
}

export function leerManifiesto(archivo: string): ManifiestoEstaticos | null {
  try {
    const m = JSON.parse(readFileSync(archivo, 'utf8')) as ManifiestoEstaticos;
    return m?.version === 1 && Array.isArray(m.estaticos) ? m : null;
  } catch {
    return null;
  }
}

export type Validacion = { ok: true } | { ok: false; motivo: string; /** URLs que cambiaron (las primeras). */ urls: string[] };

/**
 * ¿Sigue valiendo una parte en caché? Compara su manifiesto con las carpetas de ahora. `memo` comparte el trabajo entre partes
 * (el mismo estático se resuelve y se hashea una vez por render).
 */
export async function validarManifiesto(
  manifiesto: ManifiestoEstaticos | null,
  raices: RaicesEstaticos,
  hashes: FileHashCache,
  memo: Map<string, Promise<{ tipo: EntradaEstatico['tipo']; archivo?: string; hash?: string }>> = new Map(),
): Promise<Validacion> {
  if (!manifiesto) return { ok: false, motivo: 'la parte en caché no trae la lista de estáticos que usó (caché de una versión anterior)', urls: [] };
  const actual = (url: string) => {
    let p = memo.get(url);
    if (!p) {
      p = (async () => {
        const r = resolverEstatico(url, raices);
        return r.tipo === 'archivo' ? { ...r, hash: await hashes.hashOf(r.archivo!).catch(() => undefined) } : r;
      })();
      memo.set(url, p);
    }
    return p;
  };
  const cambios: { url: string; que: string }[] = [];
  for (const e of manifiesto.estaticos) {
    const a = await actual(e.url);
    if (a.tipo !== e.tipo) cambios.push({ url: e.url, que: e.tipo === 'ninguno' ? `apareció el estático ${e.url}` : a.tipo === 'ninguno' ? `desapareció el estático ${e.url}` : `el estático ${e.url} ahora sale de otro lugar` });
    else if (e.tipo === 'archivo' && (a.archivo !== e.archivo || a.hash !== e.hash)) cambios.push({ url: e.url, que: a.archivo !== e.archivo ? `el estático ${e.url} ahora sale de otra carpeta (${a.archivo})` : `cambió el estático ${e.url}` });
  }
  if (!cambios.length) return { ok: true };
  const resto = cambios.length > 1 ? ` (y ${cambios.length - 1} más)` : '';
  return { ok: false, motivo: `${cambios[0]!.que}${resto}`, urls: cambios.slice(0, 5).map((c) => c.url) };
}

