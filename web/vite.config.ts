import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5175,
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://127.0.0.1:8971', changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 2048,
  },
});
