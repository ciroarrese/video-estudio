import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Pruebas lentas de punta a punta (`*.e2e.test.*`): renderizan muchas escenas con Chromium y ffmpeg. Corren con `npm run test:e2e`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.e2e.test.{ts,tsx}'],
    exclude: ['**/node_modules/**'],
    testTimeout: 1_800_000,
  },
});
