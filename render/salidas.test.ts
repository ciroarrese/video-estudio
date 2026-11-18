// @vitest-environment node
// `npm run limpiar`: qué salidas son de un video, cuáles son más viejas que su código, y que nunca se borre fuera de la carpeta de salidas.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { baseDeSalida, borrarSalidas, estaDentro, idDe, idsDeCodigo, planearLimpieza } from './salidas';

let raiz: string;
let videos: string;
let out: string;
const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000);
const archivo = (ruta: string, dias: number, texto = 'x') => {
  mkdirSync(join(ruta, '..'), { recursive: true });
  writeFileSync(ruta, texto);
  utimesSync(ruta, hace(dias), hace(dias));
};
const defineVideo = (id: string) => `export default defineVideo({ id: '${id}', component: V, fps: 30, width: 320, height: 180, durationInFrames: 4 });\n`;

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 've-limpiar-'));
  videos = join(raiz, 'videos');
  out = join(raiz, 'out');
  mkdirSync(out);
  archivo(join(videos, 'brujula', 'index.ts'), 2, defineVideo('brujula')); // el código se tocó hace 2 días
  archivo(join(videos, 'brujula', 'historia', 'index.ts'), 2, `export default defineStory({\n  id: "brujula-historia",\n  scenes: [{ id: 'tema-uno' }],\n});\n`);
  archivo(join(videos, 'brujula-mini', 'index.ts'), 30, defineVideo('brujula-mini')); // otro video con prefijo parecido
});
afterEach(() => rmSync(raiz, { recursive: true, force: true }));

describe('lectura de ids y nombres de salida', () => {
  it('toma el id de defineVideo/defineStory y no el de las escenas', () => {
    expect(idsDeCodigo(join(videos, 'brujula'))).toEqual(['brujula', 'brujula-historia']);
  });
  it('reconoce las salidas de los comandos y descarta el resto', () => {
    expect(baseDeSalida('hola.mp4', false)).toBe('hola');
    expect(baseDeSalida('hola-vertical-f0-59.mp4', false)).toBe('hola-vertical-f0-59');
    expect(baseDeSalida('hola-liviano.mp4', false)).toBe('hola');
    expect(baseDeSalida('hola-sheet.png', false)).toBe('hola');
    expect(baseDeSalida('hola-frames', true)).toBe('hola');
    expect(baseDeSalida('notas.txt', false)).toBeNull();
    expect(baseDeSalida('hola-frames', false)).toBeNull();
  });
  it('un archivo es del id más largo que le calza', () => {
    expect(idDe('hola-mundo-vertical', ['hola', 'hola-mundo'])).toBe('hola-mundo');
    expect(idDe('hola-vertical', ['hola', 'hola-mundo'])).toBe('hola');
    expect(idDe('holandesa', ['hola'])).toBeNull();
  });
});

describe('planearLimpieza', () => {
  it('separa lo más viejo que el código de lo vigente, y no toca lo de otros videos', () => {
    archivo(join(out, 'brujula.mp4'), 10, '1234567890'); // más viejo que el código (2 días)
    archivo(join(out, 'brujula-vertical.mp4'), 10);
    archivo(join(out, 'brujula-liviano.mp4'), 10);
    archivo(join(out, 'brujula-sheet.png'), 10);
    archivo(join(out, 'brujula-historia-escena1.mp4'), 10); // la historia es del mismo slug
    archivo(join(out, 'brujula-nuevo.mp4'), 1); // más nuevo que el código: se conserva
    archivo(join(out, 'brujula-vertical-frames', 'cuadro-000.png'), 10);
    archivo(join(out, 'brujula-mini.mp4'), 10); // otro video
    archivo(join(out, 'brujula-mini-sheet.png'), 10); // otro video
    archivo(join(out, 'otra-cosa.mp4'), 10);
    archivo(join(out, 'notas.txt'), 10);
    const p = planearLimpieza('brujula', { raiz, videosDir: videos, outDir: out });
    expect(p.ids).toEqual(['brujula', 'brujula-historia']);
    expect(p.viejas.map((s) => s.nombre)).toEqual(['brujula-historia-escena1.mp4', 'brujula-liviano.mp4', 'brujula-sheet.png', 'brujula-vertical-frames', 'brujula-vertical.mp4', 'brujula.mp4']);
    expect(p.viejas.find((s) => s.esCarpeta)?.bytes).toBe(1);
    expect(p.vigentes.map((s) => s.nombre)).toEqual(['brujula-nuevo.mp4']);
  });
  it('acepta el id en vez del slug y falla con un nombre desconocido o peligroso', () => {
    expect(planearLimpieza('brujula-historia', { raiz, videosDir: videos, outDir: out }).ids).toContain('brujula');
    expect(() => planearLimpieza('nada', { raiz, videosDir: videos, outDir: out })).toThrow(/no encontré un video/);
    expect(() => planearLimpieza('../x', { raiz, videosDir: videos, outDir: out })).toThrow(/no es un slug/);
    expect(() => planearLimpieza('a/b', { raiz, videosDir: videos, outDir: out })).toThrow(/no es un slug/);
  });
  it('una carpeta de salidas que no existe da un plan vacío', () => {
    const p = planearLimpieza('brujula', { raiz, videosDir: videos, outDir: join(raiz, 'no-hay') });
    expect(p.viejas).toEqual([]);
  });
});

describe('borrar nunca sale de la carpeta de salidas', () => {
  it('borra lo que está adentro; se niega a borrar una ruta de afuera', () => {
    archivo(join(out, 'brujula.mp4'), 10);
    const fuera = join(raiz, 'importante.mp4');
    archivo(fuera, 10);
    const p = planearLimpieza('brujula', { raiz, videosDir: videos, outDir: out });
    expect(borrarSalidas(p.viejas, out).map((s) => s.nombre)).toEqual(['brujula.mp4']);
    expect(existsSync(join(out, 'brujula.mp4'))).toBe(false);
    expect(() => borrarSalidas([{ ruta: fuera, nombre: 'importante.mp4', esCarpeta: false, bytes: 1, mtimeMs: 0 }], out)).toThrow(/fuera de la carpeta de salidas/);
    expect(() => borrarSalidas([{ ruta: join(out, '..', 'importante.mp4'), nombre: 'x', esCarpeta: false, bytes: 1, mtimeMs: 0 }], out)).toThrow(/fuera/);
    expect(existsSync(fuera)).toBe(true);
    expect(estaDentro(out, join(out, 'a', 'b.mp4'))).toBe(false); // solo hijos directos
    expect(estaDentro(out, join(out, 'a.mp4'))).toBe(true);
  });
  it('un enlace simbólico dentro de out/ se borra como enlace: su destino queda', () => {
    const destino = join(raiz, 'destino');
    archivo(join(destino, 'dato.txt'), 10);
    try {
      symlinkSync(destino, join(out, 'brujula-frames'), 'dir');
    } catch {
      return; // sin permiso para enlaces (Windows sin modo desarrollador)
    }
    const s = { ruta: join(out, 'brujula-frames'), nombre: 'brujula-frames', esCarpeta: true, bytes: 0, mtimeMs: 0 };
    borrarSalidas([s], out);
    expect(existsSync(join(out, 'brujula-frames'))).toBe(false);
    expect(existsSync(join(destino, 'dato.txt'))).toBe(true);
  });
});

describe('npm run limpiar (comando)', () => {
  const tsx = (() => {
    try {
      return createRequire(import.meta.url).resolve('tsx/cli');
    } catch {
      return null;
    }
  })();
  const correr = (args: string[]) => {
    const env = { ...process.env, VE_VIDEOS_DIR: videos, VE_SIN_CONFIG_LOCAL: '1' } as NodeJS.ProcessEnv;
    delete env.VE_OUT_DIR;
    delete env.VITEST;
    return spawnSync(process.execPath, [tsx!, resolve(__dirname, 'limpiar.ts'), ...args], { encoding: 'utf8', env, input: '' });
  };
  it.skipIf(!tsx)('--seco lista y no borra; sin terminal ni --si no borra; --si borra solo lo viejo', () => {
    // con VE_VIDEOS_DIR las salidas están en <VE_VIDEOS_DIR>/out
    const salidas = join(videos, 'out');
    archivo(join(salidas, 'brujula.mp4'), 10);
    archivo(join(salidas, 'brujula-nuevo.mp4'), 1);
    archivo(join(salidas, 'brujula-mini.mp4'), 10);
    const seco = correr(['brujula', '--seco']);
    expect(seco.status).toBe(0);
    expect(seco.stdout).toContain('Se borrarían 1');
    expect(seco.stdout).toContain('brujula.mp4');
    expect(existsSync(join(salidas, 'brujula.mp4'))).toBe(true);
    const sinTerminal = correr(['brujula']);
    expect(sinTerminal.status).toBe(2);
    expect(sinTerminal.stderr).toContain('--si');
    expect(existsSync(join(salidas, 'brujula.mp4'))).toBe(true);
    const si = correr(['brujula', '--si']);
    expect(si.status).toBe(0);
    expect(existsSync(join(salidas, 'brujula.mp4'))).toBe(false);
    expect(existsSync(join(salidas, 'brujula-nuevo.mp4'))).toBe(true); // más nuevo que el código
    expect(existsSync(join(salidas, 'brujula-mini.mp4'))).toBe(true); // de otro video
    expect(correr([]).status).toBe(2);
    expect(correr(['nada', '--seco']).status).toBe(1);
  }, 60_000);
});
