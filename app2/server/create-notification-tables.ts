/**
 * نظام إنشاء وتحديث جداول الإشعارات في قاعدة البيانات
 * يعمل على إنشاء الجداول المطلوبة للنظام المتقدم للإشعارات
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

export async function createNotificationTables() {
  console.log("🔧 بدء إنشاء جداول الإشعارات المتقدمة...");

  try {
    // إنشاء جدول الإشعارات الرئيسي
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
    console.log("✅ تم إنشاء جدول notifications");

    // إنشاء جدول قوالب الإشعارات
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notification_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "type" text NOT NULL,
        "title_template" text NOT NULL,
        "body_template" text NOT NULL,
        "default_priority" integer DEFAULT 3,
        "channel_preference" jsonb DEFAULT '{"push":true,"email":false,"sms":false}',
        "variables" jsonb,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("✅ تم إنشاء جدول notification_templates");

    // إنشاء جدول إعدادات الإشعارات للمستخدمين
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
    console.log("✅ تم إنشاء جدول notification_settings");

    // إنشاء جدول طابور الإشعارات
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "notification_queue" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        "notification_id" varchar NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
        "user_id" varchar NOT NULL,
        "channel" text NOT NULL,
        "status" text DEFAULT 'pending',
        "attempts" integer DEFAULT 0,
        "max_attempts" integer DEFAULT 3,
        "next_retry" timestamp,
        "sent_at" timestamp,
        "error_message" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("✅ تم إنشاء جدول notification_queue");

    // إنشاء فهارس للأداء
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_notifications_project_id" ON "notifications"("project_id");
      CREATE INDEX IF NOT EXISTS "idx_notifications_type" ON "notifications"("type");
      CREATE INDEX IF NOT EXISTS "idx_notifications_priority" ON "notifications"("priority");
      CREATE INDEX IF NOT EXISTS "idx_notifications_created_at" ON "notifications"("created_at");
      
      CREATE INDEX IF NOT EXISTS "idx_notification_read_states_user_id" ON "notification_read_states"("user_id");
      CREATE INDEX IF NOT EXISTS "idx_notification_read_states_notification_id" ON "notification_read_states"("notification_id");
      
      CREATE INDEX IF NOT EXISTS "idx_notification_queue_notification_id" ON "notification_queue"("notification_id");
      CREATE INDEX IF NOT EXISTS "idx_notification_queue_user_id" ON "notification_queue"("user_id");
      CREATE INDEX IF NOT EXISTS "idx_notification_queue_status" ON "notification_queue"("status");
      CREATE INDEX IF NOT EXISTS "idx_notification_queue_next_retry" ON "notification_queue"("next_retry");
      
      CREATE INDEX IF NOT EXISTS "idx_notification_settings_user_id" ON "notification_settings"("user_id");
    `);
    console.log("✅ تم إنشاء الفهارس للأداء");

    console.log("✅ تم إنشاء جميع جداول الإشعارات بنجاح");
    return true;

  } catch (error) {
    console.error("❌ خطأ في إنشاء جداول الإشعارات:", error);
    throw error;
  }
}

// إنشاء بيانات تجريبية للاختبار
export async function createTestNotifications() {
  console.log("🧪 إنشاء بيانات تجريبية للإشعارات...");

  try {
    // إدراج إشعار ترحيب
    await db.execute(sql`
      INSERT INTO "notifications" (
        "type", "title", "body", "priority", "recipients", "payload"
      ) VALUES (
        'system',
        'مرحباً بك في النظام',
        'مرحباً بك في نظام إدارة المشاريع الإنشائية المتقدم. استمتع بجميع المميزات الجديدة!',
        3,
        '["default"]',
        '{"action": "open_dashboard", "version": "2.0"}'
      ) ON CONFLICT DO NOTHING;
    `);

    // إدراج قالب إشعار أمني
    await db.execute(sql`
      INSERT INTO "notification_templates" (
        "name", "type", "title_template", "body_template", "default_priority"
      ) VALUES (
        'safety-alert',
        'safety',
        'تنبيه أمني: {{severity}}',
        'تم الإبلاغ عن {{incident_type}} في {{location}}. يرجى اتخاذ الإجراءات اللازمة فوراً.',
        1
      ) ON CONFLICT DO NOTHING;
    `);

    // إدراج إعدادات افتراضية للمستخدم
    await db.execute(sql`
      INSERT INTO "notification_settings" (
        "user_id", "notification_type", "push_enabled", "email_enabled"
      ) VALUES 
        ('default', 'safety', true, true),
        ('default', 'task', true, false),
        ('default', 'payroll', true, false),
        ('default', 'announcement', true, false),
        ('default', 'system', true, false)
      ON CONFLICT DO NOTHING;
    `);

    console.log("✅ تم إنشاء البيانات التجريبية بنجاح");

  } catch (error) {
    console.error("❌ خطأ في إنشاء البيانات التجريبية:", error);
    throw error;
  }
}