module.exports = {
  apps: [
    {
      name: "server-control-panel",
      script: "server/index.ts",        // مسار ملف البداية لتطبيقك
      interpreter: "tsx",               // إذا كنت تستخدم TSX لتشغيل TypeScript
      watch: false,                     // true إذا أردت إعادة التشغيل تلقائيًا عند التغيير
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,              // 3 ثواني بين إعادة التشغيل
      env: {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://admin:Ay**772283228@93.127.142.144:5432/admindata?sslmode=disable",
        SESSION_SECRET: "pQXpw6NzkzWFP215CNb4Fthw0OaYr2rgt5gAEBgpW4j7xWoCo+uLXLKd7E4M3imKIapzHJepHrHofwv9aAXFJw==",
        PGSSL_SKIP_VERIFICATION: "true"
      },
      env_production: {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://admin:Ay**772283228@93.127.142.144:5432/admindata?sslmode=require",
        SESSION_SECRET: "ضع_هنا_سر_الإنتاج_آمن",
        PGSSL_SKIP_VERIFICATION: "false"
      }
    }
  ]
};
