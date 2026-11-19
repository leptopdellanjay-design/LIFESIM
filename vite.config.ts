import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/LIFESIM/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.replace(/\\/g, '/').includes('/src/data/events/')) return 'life-events';
        },
      },
    },
  },
}));
