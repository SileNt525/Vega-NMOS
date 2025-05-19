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
        target: 'http://localhost:3000', // Backend server address in development
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxy
      }
    }
  }
})
