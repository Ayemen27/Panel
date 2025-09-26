import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { logEnvironmentInfo } from "@shared/environment";

// تشخيص البيئة عند بداية التطبيق
console.log("🚀 Starting application...");
logEnvironmentInfo();

createRoot(document.getElementById("root")!).render(<App />);
