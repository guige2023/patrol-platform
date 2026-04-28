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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React vendor chunk
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') || 
              id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react'
          }
          // Ant Design UI framework
          if (id.includes('node_modules/antd/') || 
              id.includes('node_modules/@ant-design/') ||
              id.includes('node_modules/dayjs/')) {
            return 'vendor-antd'
          }
          // ECharts for charts/visualizations
          if (id.includes('node_modules/echarts/') || 
              id.includes('node_modules/echarts-for-react/')) {
            return 'vendor-echarts'
          }
          // Rich text editor (TinyMCE)
          if (id.includes('node_modules/@tinymce/')) {
            return 'vendor-editor'
          }
          // State management and utilities (avoiding axios to prevent circular)
          if (id.includes('node_modules/zustand/') || 
              id.includes('node_modules/@tanstack/') ||
              id.includes('node_modules/lodash-es/') ||
              id.includes('node_modules/react-use/') ||
              id.includes('node_modules/sonner/')) {
            return 'vendor-utils'
          }
        },
      },
    },
    // Raise warning limit since we're managing chunks manually
    chunkSizeWarningLimit: 600,
  },
})
