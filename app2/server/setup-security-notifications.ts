/**
 * إعداد نظام الإشعارات للسياسات الأمنية
 * ربط السياسات الأمنية مع نظام الإشعارات المتطور
 */

import { db } from "./db.js";
import { NotificationService } from "./services/NotificationService.js";
import { securityPolicyService } from "./services/SecurityPolicyService.js";
import { sql } from 'drizzle-orm';

const setupSecurityNotifications = async () => {
  try {
    console.log('🔐 بدء إعداد نظام الإشعارات للسياسات الأمنية...');
    
    const notificationService = new NotificationService();

    // إنشاء قوالب إشعارات للسياسات الأمنية
    console.log('📝 إنشاء قوالب الإشعارات...');

    // قالب إشعار سياسة جديدة
    await notificationService.createNotificationTemplate({
      name: 'security_policy_created',
      title: 'سياسة أمنية جديدة',
      body: 'تم إنشاء سياسة أمنية جديدة: {{title}}',
      type: 'security',
      priority: 2,
      metadata: {
        category: 'security_policy',
        action: 'created',
        color: '#16a34a',
        icon: '🔐'
      },
      isActive: true
    });

    // قالب إشعار انتهاك سياسة
    await notificationService.createNotificationTemplate({
      name: 'security_policy_violation',
      title: 'انتهاك سياسة أمنية',
      body: 'تم اكتشاف انتهاك: {{violatedRule}}',
      type: 'security',
      priority: 1,
      metadata: {
        category: 'security_violation',
        action: 'detected',
        color: '#dc2626',
        icon: '⚠️'
      },
      isActive: true
    });

    // قالب إشعار اقتراح سياسة
    await notificationService.createNotificationTemplate({
      name: 'security_policy_suggestion',
      title: 'اقتراح سياسة أمنية',
      body: 'اقتراح جديد: {{title}} (الثقة: {{confidence}}%)',
      type: 'security',
      priority: 3,
      metadata: {
        category: 'security_suggestion',
        action: 'suggested',
        color: '#0ea5e9',
        icon: '💡'
      },
      isActive: true
    });

    // قالب إشعار الموافقة على اقتراح
    await notificationService.createNotificationTemplate({
      name: 'security_policy_approved',
      title: 'تم تنفيذ اقتراح السياسة',
      body: 'تم تحويل الاقتراح "{{title}}" إلى سياسة فعالة',
      type: 'security',
      priority: 2,
      metadata: {
        category: 'security_approval',
        action: 'approved',
        color: '#059669',
        icon: '✅'
      },
      isActive: true
    });

    console.log('✅ تم إنشاء جميع قوالب الإشعارات');

    // إنشاء إعدادات إشعارات للمستخدم الافتراضي
    console.log('⚙️ إعداد إعدادات الإشعارات...');

    // إنشاء إعدادات افتراضية للمستخدم (تم استبدال updateNotificationSettings بتنفيذ مباشر)
    await db.execute(sql`
      INSERT INTO notification_settings (user_id, notification_type, push_enabled, email_enabled, sms_enabled)
      VALUES 
        ('default', 'security', true, false, false),
        ('default', 'security_violation', true, true, false)
      ON CONFLICT (user_id, notification_type) 
      DO UPDATE SET 
        push_enabled = EXCLUDED.push_enabled,
        email_enabled = EXCLUDED.email_enabled,
        sms_enabled = EXCLUDED.sms_enabled,
        updated_at = NOW()
    `);

    console.log('✅ تم إعداد إعدادات الإشعارات');

    // اختبار النظام بإنشاء إشعار تجريبي
    console.log('🧪 اختبار النظام...');

    await notificationService.createNotification({
      type: 'security',
      title: 'مرحباً بنظام السياسات الأمنية',
      body: 'تم تفعيل نظام السياسات الأمنية المتقدم بنجاح. جميع الميزات جاهزة للاستخدام.',
      priority: 3,
      payload: {
        category: 'system',
        feature: 'security_policies',
        version: '1.0.0'
      },
      recipients: ['default']
    });

    // إنشاء بعض الاقتراحات الذكية التجريبية
    console.log('💡 إنشاء اقتراحات ذكية تجريبية...');
    const smartSuggestions = await securityPolicyService.generateSmartSuggestions();
    console.log(`✅ تم إنشاء ${smartSuggestions.length} اقتراح ذكي`);

    console.log('🎉 تم إعداد نظام الإشعارات للسياسات الأمنية بنجاح!');

    // إحصائيات سريعة
    const stats = await getSecuritySystemStats();
    console.log('\n📊 إحصائيات النظام الأمني:');
    console.log(`   🔐 السياسات الأمنية: ${stats.policies} سياسة`);
    console.log(`   💡 الاقتراحات: ${stats.suggestions} اقتراح`);
    console.log(`   ⚠️ الانتهاكات: ${stats.violations} انتهاك`);
    console.log(`   📢 الإشعارات: ${stats.notifications} إشعار`);

  } catch (error) {
    console.error('❌ خطأ في إعداد نظام الإشعارات:', error);
    throw error;
  }
};

const getSecuritySystemStats = async () => {
  try {
    const policiesResult = await db.execute(sql`SELECT COUNT(*) as count FROM security_policies`);
    const suggestionsResult = await db.execute(sql`SELECT COUNT(*) as count FROM security_policy_suggestions`);
    const violationsResult = await db.execute(sql`SELECT COUNT(*) as count FROM security_policy_violations`);
    const notificationsResult = await db.execute(sql`SELECT COUNT(*) as count FROM notifications WHERE type = 'security'`);

    return {
      policies: Number(policiesResult.rows[0]?.count || 0),
      suggestions: Number(suggestionsResult.rows[0]?.count || 0),
      violations: Number(violationsResult.rows[0]?.count || 0),
      notifications: Number(notificationsResult.rows[0]?.count || 0)
    };
  } catch (error) {
    console.error('خطأ في جلب الإحصائيات:', error);
    return { policies: 0, suggestions: 0, violations: 0, notifications: 0 };
  }
};

// تشغيل الإعداد
setupSecurityNotifications()
  .then(() => {
    console.log('\n🎊 نظام السياسات الأمنية المتقدم جاهز للاستخدام!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 فشل في إعداد النظام:', error);
    process.exit(1);
  });