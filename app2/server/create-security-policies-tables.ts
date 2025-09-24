/**
 * إنشاء جداول السياسات الأمنية في قاعدة البيانات
 * يجب تشغيل هذا الملف مرة واحدة لإنشاء الجداول المطلوبة
 */

import { db } from "./db.js";
import { sql } from 'drizzle-orm';

const createSecurityPolicyTables = async () => {
  try {
    console.log('🔐 بدء إنشاء جداول السياسات الأمنية...');

    // إنشاء جدول security_policies
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_policies (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        policy_id VARCHAR(255) NOT NULL UNIQUE,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        severity VARCHAR(50) NOT NULL DEFAULT 'medium',
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        compliance_level VARCHAR(100),
        requirements JSONB,
        implementation JSONB,
        check_criteria JSONB,
        check_interval INTEGER,
        next_check TIMESTAMP WITH TIME ZONE,
        violations_count INTEGER NOT NULL DEFAULT 0,
        last_violation TIMESTAMP WITH TIME ZONE,
        created_by VARCHAR(255),
        approved_by VARCHAR(255),
        approved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ تم إنشاء جدول security_policies');

    // إنشاء جدول security_policy_suggestions
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_policy_suggestions (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        suggested_policy_id VARCHAR(255) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        priority VARCHAR(50) NOT NULL DEFAULT 'medium',
        confidence INTEGER NOT NULL DEFAULT 50,
        reasoning TEXT,
        estimated_impact VARCHAR(500),
        implementation_effort VARCHAR(100),
        prerequisites JSONB,
        source_type VARCHAR(100),
        source_data JSONB,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        reviewed_by VARCHAR(255),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        implemented_as VARCHAR(255),
        implemented_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        FOREIGN KEY (implemented_as) REFERENCES security_policies(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ تم إنشاء جدول security_policy_suggestions');

    // إنشاء جدول security_policy_implementations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_policy_implementations (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        policy_id VARCHAR(255) NOT NULL,
        implementation_id VARCHAR(255) NOT NULL,
        implementation_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        configuration JSONB,
        deployment_details JSONB,
        success_criteria JSONB,
        rollback_plan JSONB,
        implemented_by VARCHAR(255),
        implementation_date TIMESTAMP WITH TIME ZONE,
        verification_date TIMESTAMP WITH TIME ZONE,
        next_review TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        FOREIGN KEY (policy_id) REFERENCES security_policies(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ تم إنشاء جدول security_policy_implementations');

    // إنشاء جدول security_policy_violations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS security_policy_violations (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        policy_id VARCHAR(255) NOT NULL,
        violation_id VARCHAR(255) NOT NULL UNIQUE,
        violated_rule VARCHAR(500) NOT NULL,
        severity VARCHAR(50) NOT NULL DEFAULT 'medium',
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        violation_details JSONB,
        affected_resources JSONB,
        impact_assessment TEXT,
        remediation_steps JSONB,
        detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        FOREIGN KEY (policy_id) REFERENCES security_policies(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ تم إنشاء جدول security_policy_violations');

    // إنشاء فهارس للأداء
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_security_policies_status ON security_policies(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_security_policies_category ON security_policies(category)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_security_policies_severity ON security_policies(severity)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_security_policy_suggestions_status ON security_policy_suggestions(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_security_policy_suggestions_priority ON security_policy_suggestions(priority)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_security_policy_violations_policy_id ON security_policy_violations(policy_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_security_policy_violations_severity ON security_policy_violations(severity)`);
    console.log('✅ تم إنشاء الفهارس للأداء');

    // إضافة بيانات تجريبية
    await createSampleData();

    console.log('🎉 تم إنشاء جميع جداول السياسات الأمنية بنجاح!');
  } catch (error) {
    console.error('❌ خطأ في إنشاء جداول السياسات الأمنية:', error);
    throw error;
  }
};

const createSampleData = async () => {
  try {
    console.log('📊 إضافة بيانات تجريبية...');

    // إضافة سياسات أمنية تجريبية
    await db.execute(sql`
      INSERT INTO security_policies (
        policy_id, title, description, category, severity, status,
        compliance_level, requirements, implementation, check_criteria
      ) VALUES
      (
        'POL-AUTH-001',
        'سياسة كلمات المرور القوية',
        'تطبيق متطلبات كلمات مرور قوية لجميع المستخدمين',
        'authentication',
        'high',
        'active',
        'mandatory',
        '{"min_length": 12, "complexity": "high", "expiry": 90}',
        '{"method": "system_policy", "enforcement": "strict"}',
        '{"password_strength": "high", "compliance_check": "daily"}'
      ),
      (
        'POL-ACCESS-001',
        'التحكم في الوصول المبني على الأدوار',
        'تطبيق نظام صلاحيات متدرج بناءً على أدوار المستخدمين',
        'access_control',
        'critical',
        'active',
        'mandatory',
        '{"role_based": true, "principle": "least_privilege"}',
        '{"method": "rbac", "enforcement": "strict"}',
        '{"access_reviews": "monthly", "privilege_escalation": "none"}'
      ),
      (
        'POL-DATA-001',
        'حماية البيانات الحساسة',
        'تشفير وحماية جميع البيانات المالية والشخصية',
        'data_protection',
        'critical',
        'active',
        'mandatory',
        '{"encryption": "AES-256", "classification": "required"}',
        '{"method": "encryption", "scope": "all_sensitive_data"}',
        '{"encryption_status": "enabled", "compliance": "gdpr"}'
      )
      ON CONFLICT (policy_id) DO NOTHING
    `);

    // إضافة اقتراحات تجريبية
    await db.execute(sql`
      INSERT INTO security_policy_suggestions (
        suggested_policy_id, title, description, category, priority,
        confidence, reasoning, estimated_impact, implementation_effort
      ) VALUES
      (
        'SUGG-LOG-001',
        'تفعيل سجلات المراجعة الشاملة',
        'تطبيق نظام تسجيل شامل لجميع العمليات الحساسة',
        'audit_logging',
        'high',
        88,
        'تحليل أمني يظهر الحاجة لتتبع أفضل للأنشطة',
        'تحسين قابلية التدقيق بنسبة 85%',
        'medium'
      ),
      (
        'SUGG-NET-001',
        'تقوية أمان الشبكة',
        'تطبيق جدار حماية متقدم ومراقبة الشبكة',
        'network_security',
        'critical',
        92,
        'اكتشاف محاولات وصول غير مصرح بها',
        'منع 95% من التهديدات الشبكية',
        'high'
      )
      ON CONFLICT (suggested_policy_id) DO NOTHING
    `);

    console.log('✅ تم إضافة البيانات التجريبية');
  } catch (error) {
    console.error('❌ خطأ في إضافة البيانات التجريبية:', error);
  }
};

// تشغيل الدالة
createSecurityPolicyTables()
  .then(() => {
    console.log('🎉 اكتملت عملية إنشاء جداول السياسات الأمنية');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 فشل في إنشاء جداول السياسات الأمنية:', error);
    process.exit(1);
  });