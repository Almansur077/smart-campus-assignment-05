import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { explainApi } from './server/explainPlugin';

export default defineConfig({
  base: './',
  plugins: [react(), explainApi()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.tsx', 'tests/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
