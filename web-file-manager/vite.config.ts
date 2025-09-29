
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
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true
    },
    allowedHosts: ['all', '141ca32f-aed1-48b3-9d62-b8cb539d11e3-00-2bkgic06bqt8v.sisko.replit.dev'],
  },
  build: {
    outDir: 'dist',
  },
})
// server: {
//   allowedHosts: [
//     '141ca32f-aed1-48b3-9d62-b8cb539d11e3-00-2bkgic06bqt8v.sisko.replit.dev'
//   ]
// },