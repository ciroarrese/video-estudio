import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Emite `ve-deps.json` junto al bundle: qué archivos fuente usa el runtime (`runtime`) y cada carpeta de video
 * (`videos["examples/hello"]`), siguiendo los imports estáticos desde cada módulo. El render lo usa para que la
 * cache de partes de un video no dependa del código de los demás (ver render/README.md, "Cache por partes").
 */
function veDeps(): Plugin {
  const rel = (id: string) => relative(__dirname, id.split('?')[0]!).split('\\').join('/');
  return {
    name: 've-deps',
    generateBundle() {
      const closure = (start: string): string[] => {
        const seen = new Set<string>();
        const stack = [start];
        while (stack.length) {
          const id = stack.pop()!;
          if (seen.has(id) || id.startsWith('\0') || id.includes('node_modules')) continue;
          seen.add(id);
          stack.push(...(this.getModuleInfo(id)?.importedIds ?? []));
        }
        return [...seen].map(rel).sort();
      };
      const ids = [...this.getModuleIds()];
      const main = ids.find((i) => i.endsWith('engine/runtime/main.tsx'));
      const videosTs = ids.find((i) => i.endsWith('engine/runtime/videos.ts'));
      const videos: Record<string, string[]> = {};
      for (const loader of this.getModuleInfo(videosTs ?? '')?.dynamicallyImportedIds ?? []) {
        videos[rel(dirname(loader))] = closure(loader);
      }
      this.emitFile({ type: 'asset', fileName: 've-deps.json', source: JSON.stringify({ runtime: main ? closure(main) : [], videos }, null, 1) });
    },
  };
}

// Runtime page: engine/runtime/index.html. Static assets for asset() live in /public.
export default defineConfig({
  root: resolve(__dirname, 'engine/runtime'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [react(), veDeps()],
  build: { outDir: resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { fs: { allow: [resolve(__dirname)] } },
});
