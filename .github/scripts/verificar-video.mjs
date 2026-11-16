#!/usr/bin/env node
// Comprueba que un MP4 existe, no está vacío y que ffprobe ve en él una pista de video con medidas y duración.
// Uso: node .github/scripts/verificar-video.mjs out/hello.mp4 [--ancho 1280 --alto 720]
// Sirve en cualquier sistema (la integración continua lo corre igual en Linux, macOS y Windows). Sin dependencias.
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const opcion = (nombre) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? Number(args[i + 1]) : null;
};
const fallar = (m) => {
  console.error(`FALLO: ${m}`);
  process.exit(1);
};

if (!archivo) fallar('uso: node .github/scripts/verificar-video.mjs <archivo.mp4> [--ancho N --alto N]');
if (!existsSync(archivo)) fallar(`no existe ${archivo}`);
const bytes = statSync(archivo).size;
if (bytes < 1000) fallar(`${archivo} pesa ${bytes} bytes: está vacío o truncado`);

const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,nb_frames:format=duration', '-of', 'json', archivo], { encoding: 'utf8' });
if (r.error || r.status !== 0) fallar(`ffprobe no pudo leer ${archivo}: ${r.error?.message ?? r.stderr}`);
const info = JSON.parse(r.stdout);
const video = (info.streams ?? []).find((s) => s.codec_type === 'video');
if (!video) fallar(`${archivo} no tiene pista de video`);
const duracion = Number(info.format?.duration);
if (!(duracion > 0)) fallar(`${archivo} no tiene duración válida (${info.format?.duration})`);
const ancho = opcion('ancho');
const alto = opcion('alto');
if (ancho && video.width !== ancho) fallar(`ancho ${video.width}, se esperaba ${ancho}`);
if (alto && video.height !== alto) fallar(`alto ${video.height}, se esperaba ${alto}`);
console.log(`OK ${archivo}: ${bytes} bytes, ${video.codec_name} ${video.width}x${video.height}, ${duracion.toFixed(2)} s`);
