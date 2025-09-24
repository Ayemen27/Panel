// ⚠️ تحذير أمني: هذا الملف يحتوي على بيانات حساسة
// في البيئة الإنتاجية، يجب استخدام متغيرات البيئة بدلاً من التثبيت المباشر

export const HARDCODED_CREDENTIALS = {
  // JWT Secrets
  JWT_ACCESS_SECRET: "ebd185c17c06993902fe94b0d2628af77440140e6be2304fa9891dedb4dc14c5c5107ea13af39608c372c42e6dc3b797eba082e1d484f44e9bb08f8c4f0aa3d9",
  JWT_REFRESH_SECRET: "5246045571e21f30c5ea8e3bb051bb8e68a6dc1256f3267711e8391cad91866e849d4ecc139a8d491169f4f2a50a15680cca9bfa7181e7554cc61915f3867b20",
  
  // Encryption
  ENCRYPTION_KEY: "0367beacd2697c2d253a477e870747b7bc03ca5e0812962139e97e8541050b7d725d00726eb3fc809dbd2279fac5b53e69c25b2fbac3e4379ca98044986c5b00",
  
  // Database
  DATABASE_URL: "postgresql://app2data:Ay**--772283228@93.127.142.144:5432/app2data?sslmode=disable",
  
  // Supabase
  SUPABASE_URL: "https://wibtasmyusxfqxxqekks.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYnRhc215dXN4ZnF4eHFla2tzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjE0NzUzNjIsImV4cCI6MjAzNzA1MTM2Mn0.zB9o-Ag_QRcJhZCClmN0Pqh9CHbEjNl4KTNWOFzCEPE",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpYnRhc215dXN4ZnF4eHFla2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjk0NDEwMywiZXhwIjoyMDY4NTIwMTAzfQ.CVAZFD5nNuhXOghOKQfjATy7F4LNb3hNSuKu2ToDmis",
  
  // Supabase Database Connection
  SUPABASE_DATABASE_URL: "postgresql://postgres.wibtasmyusxfqxxqekks:Ay**--772283228@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
  SUPABASE_DATABASE_PASSWORD: "Ay**--772283228",
  
  // Environment
  NODE_ENV: "production"
};

// دالة للحصول على قيمة من متغيرات البيئة أو البيانات المثبتة
export function getCredential(key: keyof typeof HARDCODED_CREDENTIALS): string {
  // أولاً، حاول من متغيرات البيئة
  const envValue = process.env[key];
  if (envValue) {
    return envValue;
  }
  
  // إذا لم توجد، استخدم البيانات المثبتة
  return HARDCODED_CREDENTIALS[key];
}

// دالة للحصول على جميع البيانات
export function getAllCredentials() {
  const result: Record<string, string> = {};
  
  for (const key of Object.keys(HARDCODED_CREDENTIALS) as Array<keyof typeof HARDCODED_CREDENTIALS>) {
    result[key] = getCredential(key);
  }
  
  return result;
}