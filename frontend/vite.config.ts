import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3070,
    proxy: {
      '/api': {
        target: 'http://localhost:18800',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:18800',
        changeOrigin: true,
      },
    },
  },
})
