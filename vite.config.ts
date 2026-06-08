import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/setlist-maker/',
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
  },
  preview: {
    port: 5175,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
    },
  },
})
