import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { logEnvironmentInfo, ENV_CONFIG, getWebSocketUrl } from "@shared/environment";

// إصلاح مشكلة Vite HMR WebSocket في بيئة Replit
if (typeof window !== 'undefined' && ENV_CONFIG.isReplit) {
  // تعطيل error overlay للـ HMR لتجنب أخطاء WebSocket
  if (import.meta.hot) {
    import.meta.hot.on('vite:error', (payload) => {
      // تصفية أخطاء WebSocket المتعلقة بـ HMR
      if (payload.err && payload.err.message && 
          (payload.err.message.includes('WebSocket') || 
           payload.err.message.includes('localhost:undefined'))) {
        console.warn('⚠️ Vite HMR WebSocket issue (safe to ignore in Replit):', payload.err.message);
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

createRoot(document.getElementById("root")!).render(<App />);
