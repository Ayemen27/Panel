/**
 * إصلاح وإضافة جداول نظام الإشعارات المتقدم
 * تطبيق خطة التحسين المتفق عليها
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

async function fixNotificationSystem() {
  console.log("🔧 بدء إصلاح وتحديث نظام الإشعارات...");

  try {
    // 1. إنشاء جدول الإشعارات الرئيسي مع الأعمدة المحسنة
    console.log("📋 إنشاء جدول notifications...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "project_id" varchar,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "payload" jsonb,
        "priority" integer NOT NULL DEFAULT 3,
        "recipients" jsonb,
        "channel_preference" jsonb DEFAULT '{"push":true,"email":false,"sms":false}',
        "created_by" varchar,
        "scheduled_at" timestamp,
        "delivered_to" jsonb,
        "read_by" jsonb,
        "meta" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    // 2. إنشاء جدول قوالب الإشعارات
    console.log("🎨 إنشاء جدول notification_templates...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notification_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL UNIQUE,
        "type" text NOT NULL,
        "title_template" text NOT NULL,
        "body_template" text NOT NULL,
        "default_priority" integer DEFAULT 3,
        "channel_preference" jsonb DEFAULT '{"push":true,"email":false,"sms":false}',
        "variables" jsonb,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        UNIQUE("name", "type")
      );
    `);

    // 3. إنشاء جدول إعدادات الإشعارات
    console.log("⚙️ إنشاء جدول notification_settings...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notification_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" varchar NOT NULL,
        "notification_type" text NOT NULL,
        "push_enabled" boolean DEFAULT true,
        "email_enabled" boolean DEFAULT false,
        "sms_enabled" boolean DEFAULT false,
        "frequency" text DEFAULT 'immediate',
        "quiet_hours_start" time,
        "quiet_hours_end" time,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        UNIQUE("user_id", "notification_type")
      );
    `);

    // 4. إنشاء جدول حالات القراءة
    console.log("👁️ إنشاء جدول notification_read_states...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notification_read_states" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" varchar NOT NULL,
        "notification_id" varchar NOT NULL,
        "is_read" boolean DEFAULT false NOT NULL,
        "read_at" timestamp,
        "action_taken" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now() NOT NULL,
        UNIQUE("user_id", "notification_id")
      );
    `);

    // 5. إنشاء جدول طابور الإشعارات مع الأعمدة المحسنة
    console.log("🚀 إنشاء جدول notification_queue...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notification_queue" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "notification_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "channel" text NOT NULL,
        "status" text DEFAULT 'pending',
        "attempts" integer DEFAULT 0,
        "max_attempts" integer DEFAULT 3,
        "retry_count" integer DEFAULT 0,
        "last_attempt_at" timestamp,
        "next_retry" timestamp,
        "sent_at" timestamp,
        "error_message" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    // 6. إنشاء جدول المقاييس والإحصائيات الجديد
    console.log("📊 إنشاء جدول notification_metrics...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notification_metrics" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "notification_id" varchar,
        "recipient_id" varchar,
        "delivery_method" varchar,
        "status" varchar,
        "sent_at" timestamp,
        "latency_ms" integer,
        "failure_reason" text,
        "retry_count" integer DEFAULT 0,
        "channel_used" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);

    // 7. إنشاء فهارس الأداء المحسنة
    console.log("🔍 إنشاء فهارس الأداء...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_notifications_project_id" ON "notifications"("project_id");
      CREATE INDEX IF NOT EXISTS "idx_notifications_type" ON "notifications"("type");
      CREATE INDEX IF NOT EXISTS "idx_notifications_priority" ON "notifications"("priority");
      CREATE INDEX IF NOT EXISTS "idx_notifications_created_at" ON "notifications"("created_at");
      CREATE INDEX IF NOT EXISTS "idx_notifications_recipients" ON "notifications" USING GIN("recipients");
      
      CREATE INDEX IF NOT EXISTS "idx_notification_read_states_user_id" ON "notification_read_states"("user_id");
      CREATE INDEX IF NOT EXISTS "idx_notification_read_states_notification_id" ON "notification_read_states"("notification_id");
      CREATE INDEX IF NOT EXISTS "idx_notification_read_states_is_read" ON "notification_read_states"("is_read");
      
      CREATE INDEX IF NOT EXISTS "idx_notification_queue_notification_id" ON "notification_queue"("notification_id");
      CREATE INDEX IF NOT EXISTS "idx_notification_queue_user_id" ON "notification_queue"("user_id");
      CREATE INDEX IF NOT EXISTS "idx_notification_queue_status" ON "notification_queue"("status");
      CREATE INDEX IF NOT EXISTS "idx_notification_queue_next_retry" ON "notification_queue"("next_retry");
      CREATE INDEX IF NOT EXISTS "idx_notification_queue_channel" ON "notification_queue"("channel");
      
      CREATE INDEX IF NOT EXISTS "idx_notification_settings_user_id" ON "notification_settings"("user_id");
      
      CREATE INDEX IF NOT EXISTS "idx_notification_metrics_notification_id" ON "notification_metrics"("notification_id");
      CREATE INDEX IF NOT EXISTS "idx_notification_metrics_recipient_id" ON "notification_metrics"("recipient_id");
      CREATE INDEX IF NOT EXISTS "idx_notification_metrics_status" ON "notification_metrics"("status");
      CREATE INDEX IF NOT EXISTS "idx_notification_metrics_created_at" ON "notification_metrics"("created_at");
    `);

    // 8. إضافة بيانات تجريبية أساسية
    console.log("🧪 إضافة بيانات تجريبية...");
    await db.execute(sql`
      INSERT INTO "notifications" (
        "type", "title", "body", "priority", "recipients", "payload"
      ) VALUES (
        'system',
        'مرحباً بك في النظام المحدث',
        'تم تحديث نظام الإشعارات بنجاح مع جميع المميزات المتقدمة الجديدة!',
        3,
        '["default"]',
        '{"action": "open_dashboard", "version": "2.1", "updated": true}'
      ) ON CONFLICT DO NOTHING;
    `);

    // 9. إدراج قوالب إشعارات أساسية (تحقق من وجودها أولاً)
    try {
      await db.execute(sql`
        INSERT INTO "notification_templates" (
          "name", "type", "title_template", "body_template", "default_priority", "variables"
        ) 
        SELECT 'worker-payment', 'payroll', 'دفعة راتب: {{worker_name}}', 
               'تم دفع مبلغ {{amount}} ريال للعامل {{worker_name}} في مشروع {{project_name}}.', 
               2, '[{"name": "worker_name", "type": "string", "required": true}, {"name": "amount", "type": "number", "required": true}, {"name": "project_name", "type": "string", "required": true}]'
        WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE name = 'worker-payment' AND type = 'payroll')
        
        UNION ALL
        
        SELECT 'safety-alert', 'safety', 'تنبيه أمني: {{severity}}',
               'تم الإبلاغ عن {{incident_type}} في {{location}}. يرجى اتخاذ الإجراءات اللازمة فوراً.',
               1, '[{"name": "severity", "type": "string", "required": true}, {"name": "incident_type", "type": "string", "required": true}, {"name": "location", "type": "string", "required": true}]'
        WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE name = 'safety-alert' AND type = 'safety')
        
        UNION ALL
        
        SELECT 'task-assignment', 'task', 'مهمة جديدة: {{task_title}}',
               'تم تعيين مهمة جديدة لك: {{task_title}}. الموعد النهائي: {{due_date}}.',
               2, '[{"name": "task_title", "type": "string", "required": true}, {"name": "due_date", "type": "string", "required": true}]'
        WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE name = 'task-assignment' AND type = 'task')
      `);
    } catch (error) {
      console.log("⚠️ تم تخطي إدراج القوالب - قد تكون موجودة مسبقاً");
    }

    // 10. إعدادات افتراضية للمستخدمين (تحقق من وجودها أولاً)
    try {
      await db.execute(sql`
        INSERT INTO "notification_settings" ("user_id", "notification_type", "push_enabled", "email_enabled")
        -- تم حذف البيانات الافتراضية للمستخدم 'default'
        -- سيتم إنشاء إعدادات الإشعارات تلقائياً عند تسجيل المستخدمين الحقيقيين
      `);
    } catch (error) {
      console.log("⚠️ تم تخطي إدراج الإعدادات - قد تكون موجودة مسبقاً");
    }

    console.log("✅ تم إصلاح وتحديث نظام الإشعارات بنجاح!");
    
    // إحصائيات سريعة
    const stats = await getNotificationSystemStats();
    console.log("\n📊 إحصائيات النظام المحدث:");
    console.log(`   📢 الإشعارات: ${stats.notifications}`);
    console.log(`   🎨 القوالب: ${stats.templates}`);
    console.log(`   ⚙️ الإعدادات: ${stats.settings}`);
    console.log(`   📊 المقاييس: ${stats.metrics}`);

    return true;

  } catch (error) {
    console.error("❌ خطأ في إصلاح نظام الإشعارات:", error);
    throw error;
  }
}

async function getNotificationSystemStats() {
  try {
    const notificationsResult = await db.execute(sql`SELECT COUNT(*) as count FROM notifications`);
    const templatesResult = await db.execute(sql`SELECT COUNT(*) as count FROM notification_templates`);
    const settingsResult = await db.execute(sql`SELECT COUNT(*) as count FROM notification_settings`);
    const metricsResult = await db.execute(sql`SELECT COUNT(*) as count FROM notification_metrics`);

    return {
      notifications: Number(notificationsResult.rows[0]?.count || 0),
      templates: Number(templatesResult.rows[0]?.count || 0),
      settings: Number(settingsResult.rows[0]?.count || 0),
      metrics: Number(metricsResult.rows[0]?.count || 0)
    };
  } catch (error) {
    console.error('خطأ في جلب الإحصائيات:', error);
    return { notifications: 0, templates: 0, settings: 0, metrics: 0 };
  }
}

// تشغيل الإصلاح
fixNotificationSystem()
  .then(() => {
    console.log('\n🎉 نظام الإشعارات المتقدم جاهز للاستخدام!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 فشل في إصلاح النظام:', error);
    process.exit(1);
  });