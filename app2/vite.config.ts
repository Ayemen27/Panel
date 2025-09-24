import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild', // esbuild أسرع وأقل استهلاك للذاكرة من terser
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-toast'],
          charts: ['recharts'],
          excel: ['exceljs'],
          query: ['@tanstack/react-query'],
          router: ['wouter']
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop().replace('.tsx', '').replace('.ts', '') : 'chunk';
          return `assets/[name]-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|ico|webp)$/i.test(assetInfo.name)) {
            return `assets/img/[name]-[hash].${ext}`;
          }
          if (/\.(css)$/i.test(assetInfo.name)) {
            return `assets/css/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false,
    sourcemap: false
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'client/src'),
      '@assets': path.resolve(process.cwd(), 'attached_assets'),
      '@shared': path.resolve(process.cwd(), 'shared'),
      '@lib': path.resolve(process.cwd(), 'client/src/lib'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});