import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8091,
    strictPort: true,  // Prevents port auto-increment
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        // Keep the /api prefix since the backend expects it
      },
    },
  },
  build: {
    outDir: 'dist/client',
  },
});