import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve, dirname, join, sep } from 'node:path';
import { createReadStream } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetDirsFor, explicitAssetDirs } from './render/assets';
import { fileIn, MIME } from './render/server';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// VE_VIDEOS_DIR: carpeta que hace de `videos/` (videos fuera del repo, o pruebas con videos temporales sin tocar el `videos/` real).
const extVideos = process.env.VE_VIDEOS_DIR ? resolve(process.env.VE_VIDEOS_DIR) : null;

/** Carpetas de video de `dir` (`<slug>/index.ts(x)` y `<slug>/<carpeta>/index.ts(x)`), con ruta relativa; ignora las que empiezan con punto y `node_modules`. */
function indicesDeVideos(dir: string): string[] {
  const salida: string[] = [];
  const subcarpetas = (d: string) =>
    existsSync(d) ? readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules').map((e) => e.name).sort() : [];
  const indice = (rel: string) => {
    for (const ext of ['ts', 'tsx']) if (existsSync(join(dir, rel, `index.${ext}`))) salida.push(`${rel}/index.${ext}`);
  };
  for (const a of subcarpetas(dir)) {
    indice(a);
    for (const b of subcarpetas(join(dir, a))) indice(`${a}/${b}`);
  }
  return salida;
}

/**
 * Con VE_VIDEOS_DIR, `engine/runtime/videos.ts` carga los videos de esa carpeta en vez de `videos/`.
 * No se usa `import.meta.glob` con una ruta fuera del proyecto: con `../../../../tmp/...` vite devolvía un mapa VACÍO
 * (tampoco aparecían los ejemplos). En su lugar se sacan los patrones de `videos/` y se agregan imports dinámicos con
 * ruta absoluta, que rollup resuelve estén donde estén. Las claves imitan las de `videos/` (`../../videos/<slug>/index.ts`)
 * para que el runtime muestre la carpeta como `videos/<slug>`.
 */
function veVideosDir(): Plugin {
  return {
    name: 've-videos-dir',
    enforce: 'pre',
    transform(code, id) {
      if (!extVideos || !id.split('?')[0]!.endsWith('engine/runtime/videos.ts')) return null;
      const sinVideos = code.replace(/\s*'\.\.\/\.\.\/videos\/[^']*',?/g, '');
      const entradas = indicesDeVideos(extVideos).map((rel) => `  ${JSON.stringify('../../videos/' + rel)}: () => import(${JSON.stringify(join(extVideos, rel))}),`);
      const extra = `\nObject.assign(modules, {\n${entradas.join('\n')}\n});\n`;
      return { code: sinVideos.replace(/(export const videosReady)/, extra + '$1'), map: null };
    },
  };
}

/**
 * Emite `ve-deps.json` junto al bundle: qué archivos fuente usa el runtime (`runtime`) y cada carpeta de video
 * (`videos["examples/hello"]`). El render lo usa para que la cache de partes de un video no dependa del código de los
 * demás (ver render/README.md, "Cache por partes"). La clausura sigue:
 *  - imports estáticos, imports dinámicos con literal e `import.meta.glob` (vite los expande a imports);
 *  - recursos referenciados con `new URL('./x.png', import.meta.url)` con literal, aunque estén fuera de la carpeta del video.
 * Cuando algo no se puede resolver (un `new URL(variable, import.meta.url)`, un `import(variable)`), el módulo se anota como
 * "opaco" (`opaque`) y el render usa el hash de todo el bundle para ese video (nunca una huella incompleta).
 */
function veDeps(): Plugin {
  const rel = (id: string) => {
    const f = id.split('?')[0]!;
    // los archivos de VE_VIDEOS_DIR se informan como `videos/...` (el render los busca ahí con el mismo mapeo)
    if (extVideos && (f === extVideos || f.startsWith(extVideos + sep))) return ['videos', ...relative(extVideos, f).split(sep)].filter(Boolean).join('/');
    return relative(__dirname, f).split('\\').join('/');
  };
  // Lo que cada módulo referencia fuera del grafo de imports (se anota en transform, antes de que vite reescriba el código).
  const refs = new Map<string, { urls: string[]; opaque: boolean }>();
  const URL_LITERAL = /new\s+URL\(\s*(['"`])([^'"`$]*)\1\s*,\s*import\.meta\.url\s*\)/g;
  const URL_ANY = /new\s+URL\([^;]*?import\.meta\.url/g;
  const IMPORT_VAR = /(?<![\w.$])import\(\s*(?!['"`]|\/\*\s*@vite-ignore)[^\s)]/g;
  return {
    name: 've-deps',
    enforce: 'pre',
    transform(code, id) {
      const f = id.split('?')[0]!;
      if (f.includes('node_modules') || f.startsWith('\0') || !/\.[cm]?[jt]sx?$/.test(f)) return null;
      const urls: string[] = [];
      let opaque = false;
      const literal = code.match(URL_LITERAL)?.length ?? 0;
      for (const m of code.matchAll(URL_LITERAL)) {
        const p = m[2]!;
        if (/^(https?:|data:|\/\/)/.test(p)) continue;
        urls.push(p.startsWith('/') ? resolve(resolve(__dirname, 'public'), p.slice(1)) : resolve(dirname(f), p));
      }
      if ((code.match(URL_ANY)?.length ?? 0) > literal) opaque = true; // new URL(expresión, import.meta.url)
      if (IMPORT_VAR.test(code)) opaque = true; // import(expresión) sin @vite-ignore
      IMPORT_VAR.lastIndex = 0;
      if (urls.length || opaque) refs.set(f, { urls, opaque });
      return null;
    },
    generateBundle() {
      const closure = (start: string, followDynamic: boolean): { files: string[]; opaque: boolean } => {
        const seen = new Set<string>();
        const extra = new Set<string>();
        let opaque = false;
        const stack = [start];
        while (stack.length) {
          const id = stack.pop()!;
          if (seen.has(id) || id.startsWith('\0') || id.includes('node_modules')) continue;
          seen.add(id);
          const info = this.getModuleInfo(id);
          stack.push(...(info?.importedIds ?? []));
          // el runtime (main -> videos.ts) NO sigue los imports dinámicos que cargan cada video; un video sí sigue los suyos
          if (followDynamic) stack.push(...(info?.dynamicallyImportedIds ?? []));
          const r = refs.get(id.split('?')[0]!);
          if (r) {
            if (r.opaque) opaque = true;
            for (const u of r.urls) extra.add(u);
          }
        }
        return { files: [...new Set([...seen, ...extra].map(rel))].sort(), opaque };
      };
      const ids = [...this.getModuleIds()];
      const main = ids.find((i) => i.endsWith('engine/runtime/main.tsx'));
      const videosTs = ids.find((i) => i.endsWith('engine/runtime/videos.ts'));
      const videos: Record<string, string[]> = {};
      const opaque: string[] = [];
      const runtime = main ? closure(main, false) : { files: [], opaque: false };
      for (const loader of this.getModuleInfo(videosTs ?? '')?.dynamicallyImportedIds ?? []) {
        const c = closure(loader, true);
        const key = rel(dirname(loader));
        videos[key] = c.files;
        if (c.opaque || runtime.opaque) opaque.push(key);
      }
      this.emitFile({ type: 'asset', fileName: 've-deps.json', source: JSON.stringify({ runtime: runtime.files, videos, opaque }, null, 1) });
    },
  };
}

/**
 * Servidor de desarrollo (`npm run dev`): sirve las mismas carpetas de estáticos que render/qa/sheet/privacy
 * (`VE_ASSETS`, `videos/<slug>/assets|audio`, `<VE_VIDEOS_DIR>/assets`; ver render/assets.ts), así `asset("x")` y las fuentes
 * de una carpeta de afuera no dan 404. Solo actúa en `vite` (dev); el build no lo usa.
 */
function veAssets(): Plugin {
  return {
    name: 've-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        let pathname: string;
        try {
          pathname = new URL(req.url ?? '/', 'http://x').pathname;
        } catch {
          return next();
        }
        if (pathname === '/' || pathname.startsWith('/@') || pathname.endsWith('/index.html')) return next();
        for (const root of assetDirsFor(__dirname, explicitAssetDirs())) {
          const f = fileIn(root, pathname);
          if (!f || f.endsWith('index.html')) continue;
          res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
          if (req.method === 'HEAD') res.end();
          else createReadStream(f).pipe(res);
          return;
        }
        next();
      });
    },
  };
}

// Runtime page: engine/runtime/index.html. Static assets for asset() live in /public.
export default defineConfig({
  root: resolve(__dirname, 'engine/runtime'),
  publicDir: resolve(__dirname, 'public'),
  define: { __VE_VIDEOS_EXT__: JSON.stringify('') },
  resolve: {
    // Videos fuera del repo: `import { ... } from 'video-estudio/engine'` (o /kit, /themes, /fx, /fx/three) y un solo React.
    alias: [{ find: /^video-estudio\/(.+)$/, replacement: resolve(__dirname, '$1') }],
    dedupe: ['react', 'react-dom'],
  },
  plugins: [veVideosDir(), veAssets(), react(), veDeps()],
  build: { outDir: resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { fs: { allow: [resolve(__dirname), ...(extVideos ? [extVideos] : [])] } },
});
