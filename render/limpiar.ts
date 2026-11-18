// `npm run limpiar -- <slug|id>`: lista las salidas de un video (mp4, hojas, carpetas de cuadros) que son más viejas que su código y
// las borra con confirmación. No es `npm run clean`, que borra TODA la caché y TODAS las salidas.
//   npm run limpiar -- brujula            lista y pregunta antes de borrar
//   npm run limpiar -- brujula --seco     solo lista
//   npm run limpiar -- brujula --si       borra sin preguntar (scripts)
// Nunca borra fuera de la carpeta de salidas (`out/`, `<VE_VIDEOS_DIR>/out`, `VE_OUT_DIR`; ver render/dirs.ts).
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { outDirPorDefecto, videosDirExterna } from './dirs';
import { borrarSalidas, planearLimpieza, type Salida } from './salidas';

const USO = `Uso: npm run limpiar -- <slug|id> [--seco] [--si]

Lista las salidas del video (mp4, hojas, carpetas de cuadros) más viejas que su código y las borra con confirmación.
  --seco   solo lista, no borra
  --si     borra sin preguntar
Busca en la carpeta de salidas (out/, <VE_VIDEOS_DIR>/out o VE_OUT_DIR) y nunca borra fuera de ella.`;

const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;
const fecha = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

async function confirmar(pregunta: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^(s|si|sí|y|yes)$/i.test((await rl.question(pregunta)).trim());
  } finally {
    rl.close();
  }
}

async function main(argv: string[]): Promise<number> {
  const args = argv.filter((a) => a !== '--');
  if (args.includes('-h') || args.includes('--help')) {
    console.log(USO);
    return 0;
  }
  const banderas = new Set(['--seco', '--si']);
  const raras = args.filter((a) => a.startsWith('-') && !banderas.has(a));
  if (raras.length) {
    console.error(`Error: opción desconocida ${raras[0]}\n\n${USO}`);
    return 2;
  }
  const nombres = args.filter((a) => !a.startsWith('-'));
  if (nombres.length !== 1) {
    console.error(`Error: falta <slug|id> (o sobran argumentos)\n\n${USO}`);
    return 2;
  }
  const seco = args.includes('--seco');
  const si = args.includes('--si');
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = outDirPorDefecto();
  let plan;
  try {
    plan = planearLimpieza(nombres[0]!, { raiz, videosDir: videosDirExterna(), outDir });
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    return 1;
  }
  console.log(`limpiar: ${nombres[0]} (ids: ${plan.ids.join(', ')}); salidas en ${outDir}; código modificado por última vez ${fecha(plan.codigoMs)}`);
  const lista = (xs: Salida[]) => xs.forEach((s) => console.log(`  ${s.nombre}${s.esCarpeta ? '/' : ''}  ${mb(s.bytes)}  ${fecha(s.mtimeMs)}`));
  if (plan.vigentes.length) {
    console.log(`Se conservan ${plan.vigentes.length} (más nuevas que el código):`);
    lista(plan.vigentes);
  }
  if (!plan.viejas.length) {
    console.log('No hay salidas más viejas que el código: nada para borrar.');
    return 0;
  }
  const total = plan.viejas.reduce((t, s) => t + s.bytes, 0);
  console.log(`${seco ? 'Se borrarían' : 'Para borrar'} ${plan.viejas.length} (${mb(total)}, más viejas que el código):`);
  lista(plan.viejas);
  if (seco) return 0;
  if (!si) {
    if (!process.stdin.isTTY) {
      console.error('No hay terminal interactiva para confirmar: agregá --si para borrar o --seco para solo listar.');
      return 2;
    }
    if (!(await confirmar(`¿Borrar estas ${plan.viejas.length} salidas? [s/N] `))) {
      console.log('No se borró nada.');
      return 0;
    }
  }
  const borradas = borrarSalidas(plan.viejas, outDir);
  console.log(`limpiar: borradas ${borradas.length} salidas (${mb(borradas.reduce((t, s) => t + s.bytes, 0))}).`);
  return 0;
}

process.exit(await main(process.argv.slice(2)));
