import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Runtime page: engine/runtime/index.html. Static assets for asset() live in /public.
export default defineConfig({
  root: resolve(__dirname, 'engine/runtime'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [react()],
  build: { outDir: resolve(__dirname, 'dist'), emptyOutDir: true },
  server: { fs: { allow: [resolve(__dirname)] } },
});
