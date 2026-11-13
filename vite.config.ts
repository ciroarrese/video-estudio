import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// VE_VIDEOS_DIR: carpeta que hace de `videos/` (pruebas con videos temporales, sin tocar el `videos/` real).
const extVideos = process.env.VE_VIDEOS_DIR ? resolve(process.env.VE_VIDEOS_DIR) : null;
const extPrefix = extVideos ? relative(resolve(__dirname, 'engine/runtime'), extVideos).split(sep).join('/') : '';

/** Con VE_VIDEOS_DIR, `engine/runtime/videos.ts` busca los videos en esa carpeta en vez de en `videos/`. */
function veVideosDir(): Plugin {
  return {
    name: 've-videos-dir',
    enforce: 'pre',
    transform(code, id) {
      if (!extVideos || !id.split('?')[0]!.endsWith('engine/runtime/videos.ts')) return null;
      return { code: code.replaceAll("'../../videos/", `'${extPrefix}/`), map: null };
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

// Runtime page: engine/runtime/index.html. Static assets for asset() live in /public.
export default defineConfig({
  root: resolve(__dirname, 'engine/runtime'),
  publicDir: resolve(__dirname, 'public'),
  define: { __VE_VIDEOS_EXT__: JSON.stringify(extPrefix) },
  plugins: [veVideosDir(), react(), veDeps()],
  build: { outDir: resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { fs: { allow: [resolve(__dirname)] } },
});
