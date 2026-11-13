import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: '/home/user/video-estudio', plugins: [react()], test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], include: ['fx/three/**/*.test.{ts,tsx}'] } });
