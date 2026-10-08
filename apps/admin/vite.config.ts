import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  css: { postcss: fileURLToPath(new URL('../../', import.meta.url)) },
  server: { port: 3002, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
  preview: { port: 3002, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3001' } },
});
