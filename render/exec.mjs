#!/usr/bin/env node
// Corre un script TypeScript de AFUERA del repo que importa `video-estudio/*` (engine, kit, themes, fx, audio, qa, render...):
//   npm run exec -- ruta/al/script.ts [argumentos...]
// Es `tsx` con `tsconfig.exec.json` (alias `video-estudio/*` al clon y un solo React), así el script no necesita un tsconfig propio.
// La ruta del script y el directorio de trabajo son los de donde se llamó (npm cambia al del clon; acá se vuelve con INIT_CWD).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [script, ...resto] = process.argv.slice(2);
if (!script || script === '-h' || script === '--help') {
  console.error('Uso: npm run exec -- <script.ts> [argumentos...]\n\nCorre el script con tsx y el alias `video-estudio/*` resuelto al clon (ver docs/audio.md y render/README.md, "Scripts de afuera").');
  process.exit(script ? 0 : 2);
}
const cwd = process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : process.cwd();
const tsx = createRequire(import.meta.url).resolve('tsx/cli');
const hijo = spawn(process.execPath, [tsx, '--tsconfig', join(repo, 'tsconfig.exec.json'), resolve(cwd, script), ...resto], { cwd, stdio: 'inherit' });
hijo.on('exit', (code, signal) => process.exit(code ?? (signal ? 128 : 1)));
