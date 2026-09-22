import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Separate HTML/React entry, sharing dependencies and the Express API.
export default defineConfig({
  root: fileURLToPath(new URL('./admin', import.meta.url)),
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react()],
  resolve: { preserveSymlinks: true },
  server: { port: 3002, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
  preview: { port: 3002, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
  build: { outDir: fileURLToPath(new URL('./dist-admin', import.meta.url)), emptyOutDir: true },
});
