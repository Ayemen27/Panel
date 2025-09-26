
import fs from 'fs';
import path from 'path';

interface EnvironmentConfig {
  [key: string]: string | undefined;
}

class EnvLoader {
  private envConfig: EnvironmentConfig = {};
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.isInitialized) return;

    // Load from process.env first
    this.envConfig = { ...process.env };

    // Load from .env file
    this.loadEnvFile();

    // Load from ecosystem.config.json
    this.loadEcosystemConfig();

    this.isInitialized = true;
  }

  private loadEnvFile() {
    const envPath = path.join(process.cwd(), '.env');
    
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
              const keyTrimmed = key.trim();
              const value = valueParts.join('=').replace(/^["']|["']$/g, '');
              
              // Only set if not already set in process.env (preserve system env vars priority)
              if (!process.env[keyTrimmed] && !this.envConfig[keyTrimmed]) {
                this.envConfig[keyTrimmed] = value;
              }
            }
          }
        }
        console.log('✅ تم تحميل ملف .env');
      } catch (error) {
        console.warn('⚠️ خطأ في قراءة ملف .env:', error);
      }
    }
  }

  private loadEcosystemConfig() {
    const ecosystemPath = path.join(process.cwd(), 'ecosystem.config.json');
    
    if (fs.existsSync(ecosystemPath)) {
      try {
        const ecosystemContent = fs.readFileSync(ecosystemPath, 'utf8');
        const config = JSON.parse(ecosystemContent);
        
        if (config.apps && config.apps[0] && config.apps[0].env) {
          Object.assign(this.envConfig, config.apps[0].env);
          console.log('✅ تم تحميل ecosystem.config.json');
        }
      } catch (error) {
        console.warn('⚠️ خطأ في قراءة ecosystem.config.json:', error);
      }
    }
  }

  get(key: string): string | undefined {
    return this.envConfig[key];
  }

  getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`متغير البيئة المطلوب غير موجود: ${key}`);
    }
    return value;
  }

  set(key: string, value: string) {
    this.envConfig[key] = value;
    process.env[key] = value;
  }

  has(key: string): boolean {
    return key in this.envConfig;
  }

  getAll(): EnvironmentConfig {
    return { ...this.envConfig };
  }
}

export const envLoader = new EnvLoader();

export function initializeEnvironment() {
  // Force re-initialization if needed
  envLoader['isInitialized'] = false;
  envLoader['initialize']();
  
  console.log('🔧 تم تهيئة متغيرات البيئة');
}
