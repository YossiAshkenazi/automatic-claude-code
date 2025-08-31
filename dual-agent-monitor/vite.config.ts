import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6002,
    proxy: {
      '/api': {
        target: 'http://localhost:6003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:6003',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
  },
});