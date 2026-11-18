// Design systems instalados en la carpeta de videos (solo lectura).
//
// Convención: un "design system instalado" es una carpeta DIRECTA de la carpeta de videos (`videos/` o VE_VIDEOS_DIR) que
//   1. tiene `theme.ts` y `README.md` en su raíz, y
//   2. no contiene ningún `index.ts(x)` de video, ni en su raíz ni en subcarpetas (si lo tuviera, el motor la descubriría
//      como video, y un video con README no es un sistema).
// Las piezas propias (`*.tsx` en su raíz), las fuentes e imágenes (`<carpeta de videos>/assets/<sistema>/`) y un video de
// ejemplo (`<sistema>-base/`) acompañan al sistema pero no son requisito. Ver docs/instalacion.md, "Compartir un design system".
//
// Este módulo no escribe nada ni lee la configuración: `render/sistemas-cli.ts` resuelve la carpeta (render/dirs.ts) y se la pasa.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Carpetas que nunca son un sistema ni un video: recursos y archivos generados. */
const RESERVADAS = new Set(['assets', 'out', 'node_modules']);

export type SistemaInstalado = {
  /** nombre de la carpeta (el que va en `../<nombre>/theme`) */
  nombre: string;
  /** ruta de la carpeta */
  ruta: string;
  /** `theme.ts` exporta algo llamado `report` (informe del adaptador de tokens) */
  exportaReport: boolean;
  /** `<carpeta de videos>/assets/<nombre>/` existe */
  assets: string | null;
  /** `<nombre>-base/` existe (el video de ejemplo del sistema) */
  ejemplo: string | null;
  /** piezas propias: archivos `.tsx` de la raíz del sistema */
  piezas: string[];
  /** carpetas de video (slug) cuyo `theme.ts` reexporta este sistema */
  videos: string[];
};

const subcarpetas = (dir: string): string[] => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !RESERVADAS.has(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
};

/** ¿Hay un `index.ts(x)` (o `.js(x)`) en `dir` o debajo? Es lo que hace que el motor la descubra como video. */
export function tieneVideo(dir: string): boolean {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entradas) {
    if (e.isFile() && /^index\.[tj]sx?$/.test(e.name)) return true;
  }
  return subcarpetas(dir).some((s) => tieneVideo(join(dir, s)));
}

const leer = (ruta: string): string => {
  try {
    return readFileSync(ruta, 'utf8');
  } catch {
    return '';
  }
};

const esArchivo = (ruta: string): boolean => {
  try {
    return statSync(ruta).isFile();
  } catch {
    return false;
  }
};

const esCarpeta = (ruta: string): boolean => {
  try {
    return statSync(ruta).isDirectory();
  } catch {
    return false;
  }
};

/** ¿La carpeta cumple la convención de design system instalado? */
export const esSistemaInstalado = (ruta: string): boolean => esArchivo(join(ruta, 'theme.ts')) && esArchivo(join(ruta, 'README.md')) && !tieneVideo(ruta);

/** ¿Este texto de `theme.ts` reexporta el tema de `<sistema>`? (`export { theme } from "../<sistema>/theme"`, con o sin `.ts`, comillas simples o dobles) */
export const reexportaSistema = (texto: string, sistema: string): boolean => {
  const esc = sistema.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`from\\s+["']\\.\\./${esc}/theme(?:\\.ts)?["']`).test(texto);
};

/** Lista los design systems instalados en `videosDir`, por nombre. Una carpeta que no existe da `[]`. */
export function listarSistemas(videosDir: string): SistemaInstalado[] {
  const todas = subcarpetas(videosDir);
  const sistemas = todas.filter((n) => esSistemaInstalado(join(videosDir, n)));
  const carpetasVideo = todas.filter((n) => !sistemas.includes(n) && tieneVideo(join(videosDir, n)));
  return sistemas.map((nombre) => {
    const ruta = join(videosDir, nombre);
    const piezas = readdirSync(ruta, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.tsx'))
      .map((e) => e.name)
      .sort();
    const assets = join(videosDir, 'assets', nombre);
    const ejemplo = `${nombre}-base`;
    return {
      nombre,
      ruta,
      exportaReport: /\breport\b/.test(leer(join(ruta, 'theme.ts'))),
      assets: esCarpeta(assets) ? assets : null,
      ejemplo: carpetasVideo.includes(ejemplo) ? ejemplo : null,
      piezas,
      videos: carpetasVideo.filter((v) => reexportaSistema(leer(join(videosDir, v, 'theme.ts')), nombre)),
    };
  });
}

/** Texto para la persona (y para el agente): una línea de cabecera y un bloque por sistema. */
export function formatoSistemas(videosDir: string, sistemas: SistemaInstalado[]): string {
  if (!sistemas.length) {
    return [
      `sistemas: ninguno instalado en ${videosDir}`,
      'Un design system instalado es una carpeta de esa carpeta con theme.ts y README.md en su raíz y sin ningún video adentro (docs/instalacion.md, "Compartir un design system").',
    ].join('\n');
  }
  const l = [`sistemas: ${sistemas.length} instalado${sistemas.length === 1 ? '' : 's'} en ${videosDir}`];
  for (const s of sistemas) {
    l.push('', s.nombre);
    l.push(`  ruta:      ${s.ruta}`);
    l.push(`  tema:      ${s.nombre}/theme.ts (${s.exportaReport ? 'exporta theme y report' : 'sin report: solo contraste'})`);
    l.push('  README:    sí (leelo antes de usarlo: piezas y reglas de marca)');
    l.push(`  piezas:    ${s.piezas.length ? s.piezas.join(', ') : 'ninguna .tsx en la raíz'}`);
    l.push(`  assets:    ${s.assets ?? 'sin carpeta assets/' + s.nombre}`);
    l.push(`  ejemplo:   ${s.ejemplo ?? `sin ${s.nombre}-base`}`);
    l.push(`  lo usan:   ${s.videos.length ? s.videos.join(', ') : 'ningún video todavía'}`);
    l.push(`  nuevo:     npm run nuevo -- escena <slug> <nombre> --sistema ${s.nombre}`);
  }
  return l.join('\n');
}
