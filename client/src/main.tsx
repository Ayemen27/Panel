import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// حماية شاملة من خطأ process في المتصفح
if (typeof window !== 'undefined') {
  if (!window.process) {
    window.process = { env: {} } as any;
  }
  // التأكد من وجود global أيضاً
  if (!window.global) {
    window.global = window;
  }
}

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

createRoot(document.getElementById("root")!).render(<App />);
