import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config(); // تحميل متغيرات .env

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPLIT_HMR_HOST = process.env.REPLIT_URL
  ? process.env.REPLIT_URL.replace(/^https?:\/\//, '')
  : "localhost";

export default defineConfig({
  define: {
    global: 'globalThis',
    'process.env': {
      PORT: JSON.stringify(process.env.PORT || '5000'),
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
      VITE_PORT: JSON.stringify(process.env.PORT || '5000')
    },
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.PORT': JSON.stringify(process.env.PORT || '5000'),
    'process.env.VITE_PORT': JSON.stringify(process.env.PORT || '5000'),
    'import.meta.env.VITE_PORT': JSON.stringify(process.env.PORT || '5000')
  },
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID
      ? [
          (await import("@replit/vite-plugin-cartographer")).cartographer(),
          (await import("@replit/vite-plugin-dev-banner")).devBanner(),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    hmr: process.env.REPL_ID
      ? {
          host: REPLIT_HMR_HOST, // تلقائي على Replit أو fallback
          protocol: 'wss',
        }
      : {
          host: "0.0.0.0", // للسيرفر الخارجي
          port: 24678,
        },
  },
});
