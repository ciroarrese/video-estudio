import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Los casos lentos (Chromium + ffmpeg por muchas escenas) llevan `.e2e.test.` y corren aparte con `npm run test:e2e`.
    exclude: ['**/node_modules/**', '**/*.e2e.test.*'],
    testTimeout: 30000,
    setupFiles: ['./vitest.setup.ts'],
    include: ['engine/**/*.test.{ts,tsx}', 'themes/**/*.test.{ts,tsx}', 'kit/**/*.test.{ts,tsx}', 'examples/**/*.test.{ts,tsx}', 'render/**/*.test.{ts,tsx}', 'stories/**/*.test.{ts,tsx}', 'qa/**/*.test.{ts,tsx}', 'fx/**/*.test.{ts,tsx}', 'audio/**/*.test.{ts,tsx}'],
  },
});
