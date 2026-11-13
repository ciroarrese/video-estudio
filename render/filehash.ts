// Hash de contenido de archivos con una cache por (tamaño, mtime, ctime, inodo).
//
// Decisión: la clave de cache de las partes depende del CONTENIDO de `public/`, de las fuentes y de los estáticos, pero leer
// y hashear todos los archivos en cada render es caro (`public/` puede tener cientos de MB de audio e imágenes). Usar solo
// tamaño+mtime como clave sería incorrecto (un editor o `cp -p` puede dejar el mismo mtime con otro contenido), así que acá
// el hash sigue siendo de contenido: lo único que se cachea (en `.ve-cache/filehash.json`) es "este archivo, con este
// tamaño, mtime en nanosegundos, ctime e inodo, tiene este hash". El ctime lo fija el sistema operativo en cualquier
// escritura y no se puede falsear con `touch`, así que un contenido distinto con el mismo tamaño y mtime igual cambia de
// ctime y se vuelve a leer. Límite conocido: un sistema de archivos que no actualice ctime ni mtime (algunos montajes de red).
// Cada render solo hace `stat` de los archivos y lee los que cambiaron.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';

type Entry = { sig: string; hash: string };

const hashContent = (file: string) =>
  new Promise<string>((res, rej) => {
    const h = createHash('sha256');
    createReadStream(file).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej);
  });

export class FileHashCache {
  private map = new Map<string, Entry>();
  private dirty = false;
  /** Archivos que se tuvieron que leer (para pruebas y diagnóstico). */
  reads = 0;

  /** `file` vacío = cache solo en memoria. */
  constructor(private file = '') {
    if (file && existsSync(file)) {
      try {
        for (const [k, v] of Object.entries(JSON.parse(readFileSync(file, 'utf8')) as Record<string, Entry>)) this.map.set(k, v);
      } catch {
        /* cache ilegible: se rehace */
      }
    }
  }

  async hashOf(path: string): Promise<string> {
    const st = statSync(path, { bigint: true });
    const sig = `${st.size}:${st.mtimeNs}:${st.ctimeNs}:${st.ino}`;
    const hit = this.map.get(path);
    if (hit && hit.sig === sig) return hit.hash;
    this.reads++;
    const hash = await hashContent(path);
    // si el archivo cambió mientras se leía, no se cachea (el próximo render lo vuelve a leer)
    const st2 = statSync(path, { bigint: true });
    if (`${st2.size}:${st2.mtimeNs}:${st2.ctimeNs}:${st2.ino}` === sig) {
      this.map.set(path, { sig, hash });
      this.dirty = true;
    }
    return hash;
  }

  /** Guarda la cache en disco (atómico; si dos renders escriben a la vez gana el último, es solo una cache). */
  save(): void {
    if (!this.file || !this.dirty) return;
    try {
      const tmp = `${this.file}.${process.pid}.tmp`;
      const live = Object.fromEntries([...this.map].filter(([p]) => existsSync(p)));
      writeFileSync(tmp, JSON.stringify(live));
      renameSync(tmp, this.file);
      this.dirty = false;
    } catch {
      /* no es crítico */
    }
  }
}
