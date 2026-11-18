// @vitest-environment node
// Clave de la caché por estáticos realmente usados: agregar un archivo suelto NO invalida; cambiar uno que se usó SÍ; nunca un falso acierto.
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { escribirManifiesto, leerManifiesto, manifiestoDe, RegistroEstaticos, resolverEstatico, validarManifiesto, type RaicesEstaticos } from './estaticos';
import { FileHashCache } from './filehash';
import { fileInServido, serveStatic } from './server';

let base: string;
let raices: RaicesEstaticos;
const w = (rel: string, texto: string) => {
  mkdirSync(join(base, rel, '..'), { recursive: true });
  writeFileSync(join(base, rel), texto);
};
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 've-est-'));
  for (const d of ['assets', 'audio', 'bundle', 'public']) mkdirSync(join(base, d));
  raices = { assets: [join(base, 'assets'), join(base, 'audio')], bundleDir: join(base, 'bundle'), publico: join(base, 'public') };
  w('bundle/index.html', 'PAGINA');
  w('bundle/assets/index-abc123.js', 'js');
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

/** Simula un render: levanta el servidor con las mismas carpetas, pide las URLs y devuelve el manifiesto. */
async function renderConPedidos(urls: string[]) {
  const registro = new RegistroEstaticos(() => raices);
  const srv = await serveStatic([...raices.assets, raices.bundleDir, raices.publico], raices.bundleDir, { onPedido: registro.registrar });
  try {
    await fetch(`${srv.url}/`);
    for (const u of urls) await (await fetch(`${srv.url}${u}`)).arrayBuffer();
  } finally {
    await srv.close();
  }
  return { registro, manifiesto: await registro.instantanea(new FileHashCache()) };
}
const valida = async (m: Awaited<ReturnType<typeof renderConPedidos>>['manifiesto']) => validarManifiesto(m, raices, new FileHashCache());

describe('manifiesto de estáticos usados', () => {
  it('anota solo lo que se pidió, con su contenido; ignora la página, el bundle y el audio', async () => {
    w('assets/logo.png', 'LOGO');
    w('assets/otro.png', 'NO SE PIDE');
    w('assets/musica.wav', 'AUDIO');
    w('public/fuente.woff2', 'FUENTE');
    w('bundle/fuente.woff2', 'FUENTE'); // vite copia public/ dentro del bundle
    const { registro, manifiesto } = await renderConPedidos(['/logo.png', '/musica.wav', '/fuente.woff2', '/assets/index-abc123.js', '/no-esta.png']);
    expect(registro.urls).toEqual(['/fuente.woff2', '/logo.png', '/no-esta.png']);
    const porUrl = Object.fromEntries(manifiesto!.estaticos.map((e) => [e.url, e]));
    expect(porUrl['/logo.png']).toMatchObject({ tipo: 'archivo', archivo: join(base, 'assets', 'logo.png') });
    expect(porUrl['/fuente.woff2']).toMatchObject({ tipo: 'archivo', archivo: join(base, 'public', 'fuente.woff2') }); // la fuente de public/, no la copia del bundle
    expect(porUrl['/no-esta.png']).toEqual({ url: '/no-esta.png', tipo: 'ninguno' });
  });

  it('agregar un archivo suelto (que no se pidió) NO invalida', async () => {
    w('assets/logo.png', 'LOGO');
    const { manifiesto } = await renderConPedidos(['/logo.png']);
    expect(await valida(manifiesto)).toEqual({ ok: true });
    w('assets/pista-original.mp4', 'pesadísimo');
    w('assets/fuentes/intermedio.json', '{}');
    w('audio/fuentes/original.flac', 'x');
    w('audio/cues.json', '{}');
    w('public/borrador.psd', 'x');
    expect(await valida(manifiesto)).toEqual({ ok: true });
  });

  it('cambiar un estático usado SÍ invalida (aunque el tamaño y la fecha queden iguales)', async () => {
    w('assets/logo.png', 'LOGO-1');
    const f = join(base, 'assets', 'logo.png');
    const { manifiesto } = await renderConPedidos(['/logo.png']);
    const mtime = new Date(Date.now() - 86_400_000);
    utimesSync(f, mtime, mtime); // solo cambia la fecha: el contenido es el mismo, sigue valiendo
    expect(await valida(manifiesto)).toEqual({ ok: true });
    writeFileSync(f, 'LOGO-2'); // mismo tamaño, otro contenido...
    utimesSync(f, mtime, mtime); // ...y la misma fecha que antes
    expect(await valida(manifiesto)).toMatchObject({ ok: false, motivo: 'cambió el estático /logo.png', urls: ['/logo.png'] });
    writeFileSync(f, 'LOGO-1'); // vuelve el contenido original: vuelve a valer
    expect(await valida(manifiesto)).toEqual({ ok: true });
  });

  it('un archivo nuevo en una carpeta de más prioridad que tapa a uno usado invalida', async () => {
    w('audio/logo.png', 'VIEJO'); // sale de la segunda carpeta
    const { manifiesto } = await renderConPedidos(['/logo.png']);
    w('assets/logo.png', 'TAPA'); // la primera carpeta gana
    const r = await valida(manifiesto);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/el estático \/logo\.png ahora sale de otra carpeta/);
  });

  it('un pedido que daba 404 y ahora existe invalida; uno que existía y se borró también', async () => {
    w('assets/viejo.png', 'x');
    const { manifiesto } = await renderConPedidos(['/falta.png', '/viejo.png']);
    w('assets/falta.png', 'ahora sí');
    expect(await valida(manifiesto)).toMatchObject({ ok: false, motivo: expect.stringContaining('apareció el estático /falta.png') });
    rmSync(join(base, 'assets', 'falta.png'));
    rmSync(join(base, 'assets', 'viejo.png'));
    expect(await valida(manifiesto)).toMatchObject({ ok: false, motivo: expect.stringContaining('desapareció el estático /viejo.png') });
  });

  it('lo que sale de public/ se sigue por el archivo de public/ (cambiarlo invalida; el bundle viejo no engaña)', async () => {
    w('public/img.png', 'A');
    w('bundle/img.png', 'A');
    const { manifiesto } = await renderConPedidos(['/img.png']);
    expect(await valida(manifiesto)).toEqual({ ok: true });
    w('public/img.png', 'B');
    expect(await valida(manifiesto)).toMatchObject({ ok: false, urls: ['/img.png'] });
  });

  it('sin manifiesto (caché vieja o ilegible) no se acepta', async () => {
    expect(await valida(null)).toMatchObject({ ok: false });
    const f = join(base, 'seg-x.mp4');
    expect(manifiestoDe(f)).toBe(join(base, 'seg-x.estaticos.json'));
    writeFileSync(manifiestoDe(f), '{no es json');
    expect(leerManifiesto(manifiestoDe(f))).toBeNull();
    escribirManifiesto(manifiestoDe(f), { version: 1, estaticos: [] });
    expect(leerManifiesto(manifiestoDe(f))).toEqual({ version: 1, estaticos: [] });
  });

  it('si un estático cambia mientras se renderiza no se genera manifiesto', async () => {
    w('assets/logo.png', 'LOGO-1');
    const registro = new RegistroEstaticos(() => raices);
    const srv = await serveStatic([...raices.assets, raices.bundleDir, raices.publico], raices.bundleDir, { onPedido: registro.registrar });
    try {
      await (await fetch(`${srv.url}/logo.png`)).arrayBuffer();
      writeFileSync(join(base, 'assets', 'logo.png'), 'LOGO-22222'); // cambió después de que se usó
      expect(await registro.instantanea(new FileHashCache())).toBeNull();
    } finally {
      await srv.close();
    }
  });

  it('audio/fuentes/ no se sirve (404) ni entra al manifiesto; assets/fuentes/ sí se sirve', async () => {
    w('audio/fuentes/original.mp4', 'x');
    w('audio/fuentes/datos.json', '{}');
    w('assets/fuentes/Inter.woff2', 'F');
    expect(fileInServido(raices.assets[1]!, '/fuentes/datos.json')).toBeNull();
    expect(fileInServido(raices.assets[0]!, '/fuentes/Inter.woff2')).not.toBeNull();
    const { registro, manifiesto } = await renderConPedidos(['/fuentes/datos.json', '/fuentes/Inter.woff2']);
    expect(manifiesto!.estaticos.find((e) => e.url === '/fuentes/datos.json')).toEqual({ url: '/fuentes/datos.json', tipo: 'ninguno' });
    expect(registro.urls).toContain('/fuentes/Inter.woff2');
    expect(resolverEstatico('/fuentes/datos.json', raices)).toEqual({ tipo: 'ninguno' });
  });
});
