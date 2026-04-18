import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
    compression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          maplibre: ['maplibre-gl'],
        },
      },
    },
  },
});
