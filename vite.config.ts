import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/**',
      '**/.obsidian/**',
    ],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['papaparse'],
  },
});
