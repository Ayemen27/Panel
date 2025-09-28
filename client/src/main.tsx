
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { logEnvironmentInfo, ENV_CONFIG, getWebSocketUrl } from "@shared/environment";
import { errorLogger, updateAppState } from "./lib/errorLogger";

// Create a single QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // إذا كان الخطأ 401 (Unauthorized) أو 500، لا تعيد المحاولة
        if (error instanceof Error && (
          error.message.includes('401') ||
          error.message.includes('500') ||
          error.message.includes('Unauthorized') ||
          error.message.includes('Internal Server Error')
        )) {
          console.log('🚫 Authentication/Server error - not retrying query:', error.message);
          return false;
        }
        return failureCount < 2; // قلل عدد المحاولات
      },
    },
  },
});

// Add global error handler for better debugging
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  if (event.error?.message?.includes('process.cwd')) {
    console.error('Browser compatibility issue: process.cwd() called in browser context');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Fix Node.js process polyfill for browser
if (typeof window !== 'undefined') {
  if (!window.process) {
    window.process = {} as any;
  }

  // Ensure process.env exists
  if (!window.process.env) {
    window.process.env = { NODE_ENV: 'development' };
  }

  // Fix process.cwd to prevent errors
  if (!window.process.cwd || typeof window.process.cwd !== 'function') {
    window.process.cwd = () => '/';
  }

  // Add other required process properties
  window.process.platform = 'browser';
  window.process.version = 'v18.0.0';
  window.process.versions = window.process.versions || { node: '18.0.0' };
}

// إصلاح مشكلة Vite HMR WebSocket في بيئة Replit
if (typeof window !== 'undefined' && ENV_CONFIG.isReplit) {
  // تعطيل error overlay للـ HMR لتجنب أخطاء WebSocket
  if (import.meta.hot) {
    import.meta.hot.on('vite:error', (payload) => {
      // تصفية أخطاء WebSocket المتعلقة بـ HMR
      if (payload.err && payload.err.message &&
          (payload.err.message.includes('WebSocket') ||
           payload.err.message.includes('localhost:undefined') ||
           payload.err.message.includes('process.cwd'))) {
        console.warn('⚠️ Vite HMR issue (safe to ignore in Replit):', payload.err.message);
        return; // تجاهل هذه الأخطاء
      }
    });
  }

  // إصلاح Vite client WebSocket URL إذا كان غير صحيح
  const originalWebSocket = window.WebSocket;
  const WebSocketConstructor = class extends originalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      // إصلاح URLs الخاطئة للـ HMR
      if (typeof url === 'string' &&
          (url.includes('localhost:undefined') ||
           url.includes('//localhost:undefined') ||
           url.includes('ws://localhost:undefined'))) {
        // استخدام URL صحيح لـ HMR
        const fixedUrl = `wss://${window.location.hostname}:24678`;
        console.log('🔧 Fixed Vite HMR WebSocket URL:', fixedUrl);
        super(fixedUrl, protocols);
      } else {
        super(url, protocols);
      }
    }
  };

  // استبدال WebSocket العالمي
  window.WebSocket = WebSocketConstructor as any;
}

// تشخيص البيئة عند بداية التطبيق
console.log("🚀 Starting application...");
console.log("🌍 ENVIRONMENT DETECTED:");
console.log("Environment:", ENV_CONFIG.name);
console.log("Is Replit:", ENV_CONFIG.isReplit);
console.log("Host:", ENV_CONFIG.host);
console.log("Port:", ENV_CONFIG.port);
console.log("WebSocket URL:", getWebSocketUrl());
console.log("Current hostname:", typeof window !== 'undefined' ? window.location.hostname : 'server');
logEnvironmentInfo();

// تهيئة نظام تسجيل الأخطاء
if (typeof window !== 'undefined') {
  // تحديث حالة التطبيق مع معلومات البيئة
  updateAppState({
    environment: ENV_CONFIG.name,
    isReplit: ENV_CONFIG.isReplit,
    host: ENV_CONFIG.host,
    port: ENV_CONFIG.port,
    startupTime: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  });

  console.log('🔍 ErrorLogger initialized in main.tsx');
}

// اختبار الاتصالات تلقائياً
if (typeof window !== 'undefined') {
  import('./utils/connectionTest').then(({ testConnections, logConnectionTestResults }) => {
    // تأخير قصير للسماح للتطبيق بالتحميل أولاً
    setTimeout(async () => {
      console.log('🔍 Running automatic connection tests...');
      try {
        const result = await testConnections();
        logConnectionTestResults(result);

        if (result.errors.length > 0) {
          console.warn('⚠️ اكتشفت مشاكل في الاتصال. يرجى التحقق من الأخطاء أعلاه.');
        } else {
          console.log('✅ جميع الاتصالات تعمل بشكل صحيح!');
        }
      } catch (error) {
        console.error('❌ فشل في اختبار الاتصالات:', error);
      }
    }, 2000);
  }).catch(console.error);
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
