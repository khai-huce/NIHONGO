import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3001'
    },
    open: true
  }
})
