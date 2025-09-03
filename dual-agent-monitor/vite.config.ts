import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6011,
    strictPort: true,  // Prevents port auto-increment
    proxy: {
      '/api': {
        target: 'http://localhost:4005',
        changeOrigin: true,
        // Keep the /api prefix since the backend expects it
      },
      '/ws': {
        target: 'ws://localhost:4005',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, ''),
      },
    },
  },
  build: {
    outDir: 'dist/client',
  },
});