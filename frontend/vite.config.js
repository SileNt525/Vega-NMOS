/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,      // Explicitly define port (optional, Vite default is 5173)
    proxy: {
      '/api': {
        target: 'http://backend:3000', // Backend server address
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, ''), // Optional: if backend doesn't expect /api prefix
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js', // Optional: if you need setup files
  },
})