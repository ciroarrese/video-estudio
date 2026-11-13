// Revisión de tipos de la carpeta de videos de afuera (VE_VIDEOS_DIR), con el tsconfig.json de esa carpeta.
//   npm run typecheck:videos        exige VE_VIDEOS_DIR
//   npm run typecheck               corre `tsc` del repo y, si VE_VIDEOS_DIR está definida, esta revisión (`--opcional`)
// El tsconfig.json de la carpeta lo crea `VE_VIDEOS_DIR=... bash templates/nuevo.sh externo` (ver templates/externo/).
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const opcional = process.argv.includes('--opcional');
const dir = process.env.VE_VIDEOS_DIR ? resolve(process.env.VE_VIDEOS_DIR) : null;

if (!dir) {
  if (opcional) process.exit(0);
  console.error('typecheck:videos necesita VE_VIDEOS_DIR=/ruta/a/mis-videos (la carpeta de videos fuera del repo).');
  process.exit(2);
}
if (!existsSync(dir) || !statSync(dir).isDirectory()) {
  console.error(`VE_VIDEOS_DIR apunta a "${dir}", que no existe o no es una carpeta.`);
  process.exit(2);
}
const tsconfig = join(dir, 'tsconfig.json');
if (!existsSync(tsconfig)) {
  console.error(`Falta ${tsconfig}. Crealo con:  VE_VIDEOS_DIR=${dir} bash templates/nuevo.sh externo   (deja tsconfig.json y env.d.ts; ver templates/externo/README.txt).`);
  process.exit(1);
}
console.log(`typecheck:videos: ${tsconfig}`);
const r = spawnSync(join(repo, 'node_modules', '.bin', 'tsc'), ['--noEmit', '-p', tsconfig], { stdio: 'inherit', cwd: dir });
process.exit(r.status ?? 1);
