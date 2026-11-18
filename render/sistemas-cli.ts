// `npm run sistemas`: lista los design systems instalados en la carpeta de videos (solo lectura).
//   npm run sistemas            texto
//   npm run sistemas -- --json  JSON (para el agente)
// La carpeta es la de VE_VIDEOS_DIR o `.video-studio.local.json` (render/dirs.ts); sin ninguna, `videos/` del clon.
// Convención y lógica: render/sistemas.ts.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { videosDirExterna } from './dirs';
import { formatoSistemas, listarSistemas } from './sistemas';

const USO = `Uso: npm run sistemas [-- --json]

Lista los design systems instalados en la carpeta de videos (VE_VIDEOS_DIR, .video-studio.local.json o videos/ del clon): carpetas con
theme.ts y README.md en su raíz y sin ningún video adentro. No escribe nada.`;

function main(argv: string[]): number {
  const args = argv.filter((a) => a !== '--');
  if (args.includes('-h') || args.includes('--help')) {
    console.log(USO);
    return 0;
  }
  const raras = args.filter((a) => a !== '--json');
  if (raras.length) {
    console.error(`Error: argumento desconocido ${raras[0]}\n\n${USO}`);
    return 2;
  }
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = videosDirExterna() ?? join(raiz, 'videos');
  const sistemas = listarSistemas(dir);
  console.log(args.includes('--json') ? JSON.stringify({ carpeta: dir, sistemas }, null, 2) : formatoSistemas(dir, sistemas));
  return 0;
}

process.exit(main(process.argv.slice(2)));
