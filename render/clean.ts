// `npm run clean`: borra `.ve-cache/` y `out/` del clon y, si VE_VIDEOS_DIR (o VE_CACHE_DIR / VE_OUT_DIR) está definida, también los de afuera.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limpiar } from './dirs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const borrados = limpiar(raiz);
if (borrados.length === 0) console.log('clean: no había nada para borrar.');
else for (const d of borrados) console.log(`clean: borrado ${d}`);
