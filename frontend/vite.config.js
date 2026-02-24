import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['167.86.71.246.nip.io', '167.86.71.246', 'localhost', '127.0.0.1'],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['167.86.71.246.nip.io', '167.86.71.246', 'localhost', '127.0.0.1'],
  },
})
