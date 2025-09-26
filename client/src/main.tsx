import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { logEnvironmentInfo, ENV_CONFIG, getWebSocketUrl } from "@shared/environment";

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
