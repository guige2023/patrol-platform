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
    port: 3005,
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
          if (!id.includes('node_modules')) return
          // Core React vendor chunk — match any react/* or react-router-dom
          if (/\bnode_modules\/react(-dom)?\//.test(id) || /\bnode_modules\/react-router(-dom)?\//.test(id)) {
            return 'vendor-react'
          }
          // Ant Design UI framework
          if (/\bnode_modules\/(antd|@ant-design|dayjs)\//.test(id)) {
            return 'vendor-antd'
          }
          // ECharts for charts/visualizations
          if (/\bnode_modules\/echarts(-for-react)?\//.test(id)) {
            return 'vendor-echarts'
          }
          // Rich text editor (TinyMCE)
          if (/\bnode_modules\/@tinymce\//.test(id)) {
            return 'vendor-editor'
          }
          // State management and utilities
          if (/\bnode_modules\/(zustand|@tanstack|lodash-es|react-use|sonner)\//.test(id)) {
            return 'vendor-utils'
          }
        },
      },
    },
    // Raise warning limit since we're managing chunks manually
    chunkSizeWarningLimit: 600,
  },
})
