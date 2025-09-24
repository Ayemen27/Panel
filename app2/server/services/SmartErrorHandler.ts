/**
 * نظام كشف الأخطاء الذكي - SmartErrorHandler
 * طبقة ذكية للتعامل مع جميع أخطاء Drizzle ORM وقاعدة البيانات
 * يقوم بتحليل الأخطاء وتحويلها إلى إشعارات مفهومة ومنع التكرار
 * 
 * الميزات الذكية:
 * - تحليل تلقائي لأنواع الأخطاء
 * - بصمة فريدة لكل خطأ لمنع التكرار  
 * - تكامل مع نظام الإشعارات
 * - رسائل صديقة للمستخدم
 * - إحصائيات ذكية للأخطاء
 */

import crypto from 'crypto';
import { NotificationService, NotificationPayload } from './NotificationService';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface DatabaseError {
  code?: string;
  message: string;
  detail?: string;
  hint?: string;
  position?: string;
  internalPosition?: string;
  internalQuery?: string;
  where?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
  file?: string;
  line?: string;
  routine?: string;
}

export interface ErrorContext {
  operation: 'insert' | 'update' | 'delete' | 'select';
  tableName?: string;
  columnName?: string;
  attemptedValue?: any;
  userId?: string;
  projectId?: string;
  stackTrace?: string;
  queryExecuted?: string;
  executionTime?: number;
  additionalContext?: Record<string, any>;
}

export interface AnalyzedError {
  // معلومات أساسية
  errorType: string;
  errorCode?: string;
  tableName: string;
  columnName?: string;
  operation: string;
  
  // رسائل
  originalMessage: string;
  friendlyMessage: string;
  arabicMessage: string;
  
  // التحليل الذكي
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'data_integrity' | 'performance' | 'security' | 'logic' | 'system';
  fingerprint: string;
  
  // السياق
  context: ErrorContext;
  
  // الحلول المقترحة
  suggestedSolutions?: string[];
  preventionTips?: string[];
  documentationLinks?: string[];
}

/**
 * خدمة النظام الذكي لكشف وتحليل الأخطاء
 */
export class SmartErrorHandler {
  private notificationService: NotificationService;
  private errorCache: Map<string, { count: number; lastSeen: Date; suppressUntil?: Date }> = new Map();
  
  // فترات التهدئة للإشعارات (بالثواني)
  private readonly NOTIFICATION_COOLDOWNS = {
    low: 3600,      // ساعة واحدة
    medium: 1800,   // 30 دقيقة  
    high: 600,      // 10 دقائق
    critical: 60    // دقيقة واحدة
  };

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * التعامل الذكي مع خطأ قاعدة البيانات
   */
  async handleDatabaseError(
    error: DatabaseError, 
    context: ErrorContext,
    throwError: boolean = true
  ): Promise<AnalyzedError> {
    console.log('🔍 نظام كشف الأخطاء الذكي: بدء تحليل خطأ جديد');
    
    try {
      // 1. تحليل الخطأ بذكاء
      const analyzedError = await this.analyzeError(error, context);
      
      console.log(`📊 نوع الخطأ المحلل: ${analyzedError.errorType}`);
      console.log(`🎯 شدة الخطأ: ${analyzedError.severity}`);
      console.log(`🔖 بصمة الخطأ: ${analyzedError.fingerprint.substring(0, 12)}...`);
      
      // 2. فحص التكرار ومنع الإزعاج
      const shouldNotify = await this.shouldSendNotification(analyzedError);
      
      // 3. حفظ الخطأ في قاعدة البيانات
      await this.logErrorToDatabase(analyzedError);
      
      // 4. إرسال إشعار ذكي إذا كان مناسباً
      if (shouldNotify) {
        await this.sendSmartNotification(analyzedError);
      }
      
      // 5. تحديث الإحصائيات
      this.updateErrorCache(analyzedError);
      
      console.log('✅ تم التعامل مع الخطأ بذكاء وحفظ السجلات');
      
      // رمي الخطأ إذا كان مطلوباً (للحفاظ على سلوك التطبيق الطبيعي)
      if (throwError) {
        const enhancedError = new Error(analyzedError.arabicMessage);
        (enhancedError as any).originalError = error;
        (enhancedError as any).analyzedError = analyzedError;
        throw enhancedError;
      }
      
      return analyzedError;
      
    } catch (analysisError) {
      console.error('❌ خطأ في نظام تحليل الأخطاء الذكي:', analysisError);
      
      // في حالة فشل التحليل، نعيد خطأ مبسط
      const fallbackError: AnalyzedError = {
        errorType: 'UnknownError',
        errorCode: error.code,
        tableName: context.tableName || 'unknown',
        columnName: context.columnName,
        operation: context.operation,
        originalMessage: error.message,
        friendlyMessage: 'حدث خطأ غير متوقع في قاعدة البيانات',
        arabicMessage: 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى',
        severity: 'medium',
        category: 'system',
        fingerprint: this.generateErrorFingerprint(error, context),
        context
      };
      
      if (throwError) {
        throw new Error(fallbackError.arabicMessage);
      }
      
      return fallbackError;
    }
  }

  /**
   * تحليل ذكي للخطأ وتحديد نوعه وشدته
   */
  private async analyzeError(error: DatabaseError, context: ErrorContext): Promise<AnalyzedError> {
    const fingerprint = this.generateErrorFingerprint(error, context);
    
    // تحليل بناء على رمز الخطأ PostgreSQL
    let errorType = 'UnknownError';
    let friendlyMessage = 'حدث خطأ في قاعدة البيانات';
    let arabicMessage = 'حدث خطأ، يرجى المحاولة مرة أخرى';
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let category: 'data_integrity' | 'performance' | 'security' | 'logic' | 'system' = 'system';
    let suggestedSolutions: string[] = [];
    let preventionTips: string[] = [];

    // تحليل ذكي بناء على أكواد PostgreSQL الشائعة
    switch (error.code) {
      case '23505': // انتهاك القيد الفريد
        errorType = 'UniqueConstraintViolation';
        friendlyMessage = 'البيانات المدخلة موجودة مسبقاً';
        arabicMessage = this.generateUniqueViolationMessage(context);
        severity = 'low';
        category = 'data_integrity';
        suggestedSolutions = [
          'تحقق من البيانات المدخلة',
          'استخدم بيانات مختلفة',
          'قم بتحديث السجل الموجود بدلاً من إضافة جديد'
        ];
        preventionTips = [
          'تحقق من وجود البيانات قبل الإدراج',
          'استخدم معرفات فريدة',
          'قم بتطبيق التحقق في الواجهة الأمامية'
        ];
        break;

      case '23503': // انتهاك المفتاح الأجنبي  
        errorType = 'ForeignKeyViolation';
        friendlyMessage = 'البيانات المرجعية غير صحيحة أو غير موجودة';
        arabicMessage = 'لا يمكن تنفيذ العملية لأن البيانات المطلوبة غير موجودة';
        severity = 'medium';
        category = 'data_integrity';
        suggestedSolutions = [
          'تأكد من وجود السجل المرجعي',
          'تحقق من صحة المعرفات المستخدمة',
          'قم بإنشاء السجلات المرجعية أولاً'
        ];
        break;

      case '23502': // قيمة NULL غير مسموحة
        errorType = 'NotNullViolation';
        friendlyMessage = 'بعض البيانات المطلوبة مفقودة';
        arabicMessage = `يجب إدخال ${this.getFieldDisplayName(context.columnName)} - هذا الحقل مطلوب`;
        severity = 'low';
        category = 'data_integrity';
        suggestedSolutions = [
          'تأكد من إدخال جميع البيانات المطلوبة',
          'تحقق من النموذج قبل الإرسال'
        ];
        break;

      case '22001': // بيانات طويلة جداً
        errorType = 'DataTooLong';
        friendlyMessage = 'البيانات المدخلة طويلة جداً';
        arabicMessage = 'النص المدخل طويل جداً، يرجى تقصيره';
        severity = 'low';
        category = 'data_integrity';
        break;

      case '08006': // فشل الاتصال
        errorType = 'ConnectionFailure';
        friendlyMessage = 'مشكلة في الاتصال بقاعدة البيانات';
        arabicMessage = 'مشكلة مؤقتة في الاتصال، يرجى المحاولة بعد قليل';
        severity = 'critical';
        category = 'system';
        break;

      case '53300': // عدم توفر مساحة كافية
        errorType = 'InsufficientStorage';
        friendlyMessage = 'مساحة التخزين ممتلئة';
        arabicMessage = 'مساحة التخزين ممتلئة، يرجى التواصل مع الدعم الفني';
        severity = 'critical';
        category = 'system';
        break;

      default:
        // تحليل بناء على النص إذا لم يكن الكود معروفاً
        if (error.message.includes('timeout')) {
          errorType = 'QueryTimeout';
          arabicMessage = 'العملية تستغرق وقتاً طويلاً، يرجى المحاولة مرة أخرى';
          severity = 'medium';
          category = 'performance';
        } else if (error.message.includes('permission')) {
          errorType = 'PermissionDenied';
          arabicMessage = 'ليس لديك صلاحية لتنفيذ هذه العملية';
          severity = 'high';
          category = 'security';
        }
    }

    return {
      errorType,
      errorCode: error.code,
      tableName: context.tableName || 'unknown',
      columnName: context.columnName,
      operation: context.operation,
      originalMessage: error.message,
      friendlyMessage,
      arabicMessage,
      severity,
      category,
      fingerprint,
      context,
      suggestedSolutions,
      preventionTips,
      documentationLinks: [`/docs/errors/${errorType.toLowerCase()}`]
    };
  }

  /**
   * توليد بصمة فريدة للخطأ لمنع التكرار
   */
  private generateErrorFingerprint(error: DatabaseError, context: ErrorContext): string {
    const fingerprintData = {
      code: error.code,
      table: context.tableName,
      column: context.columnName,
      operation: context.operation,
      constraint: error.constraint,
      // نتجاهل القيمة المحاولة والمستخدم لتجميع الأخطاء المتشابهة
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');
  }

  /**
   * فحص ما إذا كان يجب إرسال إشعار للخطأ
   */
  private async shouldSendNotification(error: AnalyzedError): Promise<boolean> {
    const cached = this.errorCache.get(error.fingerprint);
    const now = new Date();
    
    // فحص فترة التهدئة
    if (cached?.suppressUntil && now < cached.suppressUntil) {
      console.log(`🔇 الإشعار متوقف لهذا الخطأ حتى: ${cached.suppressUntil}`);
      return false;
    }
    
    // إرسال إشعار فقط للأخطاء الجديدة أو بعد انتهاء فترة التهدئة
    if (!cached || (cached.suppressUntil && now >= cached.suppressUntil)) {
      return true;
    }
    
    // للأخطاء الحرجة، نقلل فترة التهدئة
    if (error.severity === 'critical' && cached.count > 5) {
      return true;
    }
    
    return false;
  }

  /**
   * إرسال إشعار ذكي للخطأ
   */
  private async sendSmartNotification(error: AnalyzedError): Promise<void> {
    try {
      const notificationPayload: NotificationPayload = {
        type: 'system',
        title: `🔧 خطأ في النظام: ${error.errorType}`,
        body: this.buildNotificationBody(error),
        priority: this.mapSeverityToPriority(error.severity),
        recipients: ['default'], // سيتم إرسال للإدارة
        projectId: error.context.projectId,
        payload: {
          errorType: error.errorType,
          tableName: error.tableName,
          fingerprint: error.fingerprint,
          severity: error.severity,
          category: error.category,
          suggestedSolutions: error.suggestedSolutions,
          action: 'view_smart_errors',
          route: '/smart-errors'
        },
        channelPreference: {
          push: true,
          email: error.severity === 'critical',
          sms: error.severity === 'critical'
        }
      };

      await this.notificationService.createNotification(notificationPayload);
      console.log(`📧 تم إرسال إشعار ذكي للخطأ: ${error.errorType}`);
      
    } catch (notificationError) {
      console.error('❌ خطأ في إرسال الإشعار:', notificationError);
    }
  }

  /**
   * بناء محتوى الإشعار
   */
  private buildNotificationBody(error: AnalyzedError): string {
    let body = `الجدول: ${this.getTableDisplayName(error.tableName)}\n`;
    
    if (error.columnName) {
      body += `الحقل: ${this.getFieldDisplayName(error.columnName)}\n`;
    }
    
    body += `النوع: ${error.operation === 'insert' ? 'إدراج' : error.operation === 'update' ? 'تحديث' : error.operation === 'delete' ? 'حذف' : 'استعلام'}\n`;
    
    if (error.suggestedSolutions && error.suggestedSolutions.length > 0) {
      body += `\n💡 الحلول المقترحة:\n${error.suggestedSolutions.map(s => `• ${s}`).join('\n')}`;
    }
    
    return body;
  }

  /**
   * تحديث كاش الأخطاء
   */
  private updateErrorCache(error: AnalyzedError): void {
    const existing = this.errorCache.get(error.fingerprint);
    const cooldownSeconds = this.NOTIFICATION_COOLDOWNS[error.severity];
    
    this.errorCache.set(error.fingerprint, {
      count: existing ? existing.count + 1 : 1,
      lastSeen: new Date(),
      suppressUntil: new Date(Date.now() + cooldownSeconds * 1000)
    });
  }

  /**
   * حفظ الخطأ في قاعدة البيانات
   */
  private async logErrorToDatabase(error: AnalyzedError): Promise<void> {
    try {
      // إنشاء جداول الأخطاء إذا لم تكن موجودة
      await this.ensureErrorTablesExist();
      
      // حفظ سجل الخطأ
      const insertQuery = sql`
        INSERT INTO error_logs (
          error_type, error_code, table_name, column_name, operation,
          original_message, friendly_message, context, attempted_value,
          user_id, project_id, stack_trace, query_executed, execution_time,
          severity, category, fingerprint, status, occurrence_count,
          first_seen, last_seen, notification_sent, created_at, updated_at
        ) VALUES (
          ${error.errorType}, ${error.errorCode || null}, ${error.tableName}, ${error.columnName || null},
          ${error.operation}, ${error.originalMessage}, ${error.arabicMessage},
          ${JSON.stringify(error.context)}, ${String(error.context.attemptedValue || '')},
          ${error.context.userId || null}, ${error.context.projectId || null}, ${error.context.stackTrace || null},
          ${error.context.queryExecuted || null}, ${error.context.executionTime || null},
          ${error.severity}, ${error.category}, ${error.fingerprint}, 'new', 1,
          NOW(), NOW(), true, NOW(), NOW()
        )
        ON CONFLICT (fingerprint) 
        DO UPDATE SET
          occurrence_count = error_logs.occurrence_count + 1,
          last_seen = NOW(),
          updated_at = NOW(),
          notification_sent = true
      `;
      
      await db.execute(insertQuery);
      console.log('💾 تم حفظ سجل الخطأ في قاعدة البيانات');
      
    } catch (dbError) {
      console.error('❌ خطأ في حفظ سجل الخطأ:', dbError);
    }
  }

  /**
   * التأكد من وجود جداول الأخطاء
   */
  private async ensureErrorTablesExist(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS error_logs (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          error_type TEXT NOT NULL,
          error_code TEXT,
          table_name TEXT NOT NULL,
          column_name TEXT,
          operation TEXT NOT NULL,
          original_message TEXT NOT NULL,
          friendly_message TEXT NOT NULL,
          context JSONB,
          attempted_value TEXT,
          user_id VARCHAR,
          project_id VARCHAR,
          stack_trace TEXT,
          query_executed TEXT,
          execution_time INTEGER,
          severity TEXT DEFAULT 'medium' NOT NULL,
          category TEXT NOT NULL,
          fingerprint TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT 'new' NOT NULL,
          resolved_by VARCHAR,
          resolved_at TIMESTAMP,
          resolution_notes TEXT,
          occurrence_count INTEGER DEFAULT 1 NOT NULL,
          first_seen TIMESTAMP DEFAULT NOW() NOT NULL,
          last_seen TIMESTAMP DEFAULT NOW() NOT NULL,
          notification_sent BOOLEAN DEFAULT false NOT NULL,
          last_notification_sent TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `);
      
      // إنشاء الفهارس للأداء
      await db.execute(sql`CREATE INDEX IF NOT EXISTS error_logs_fingerprint_idx ON error_logs (fingerprint)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS error_logs_severity_idx ON error_logs (severity)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS error_logs_table_name_idx ON error_logs (table_name)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON error_logs (created_at DESC)`);
      
    } catch (error) {
      console.error('❌ خطأ في إنشاء جداول الأخطاء:', error);
    }
  }

  // دوال مساعدة للعرض

  private generateUniqueViolationMessage(context: ErrorContext): string {
    const tableName = this.getTableDisplayName(context.tableName);
    const fieldName = this.getFieldDisplayName(context.columnName);
    
    if (context.tableName === 'users' && context.columnName === 'email') {
      return 'عنوان البريد الإلكتروني مستخدم مسبقاً';
    }
    
    if (context.tableName === 'projects' && context.columnName === 'name') {
      return 'اسم المشروع موجود مسبقاً، يرجى اختيار اسم آخر';
    }
    
    if (context.tableName === 'workers' && context.columnName === 'name') {
      return 'اسم العامل مسجل مسبقاً';
    }
    
    if (fieldName && tableName) {
      return `${fieldName} في ${tableName} موجود مسبقاً`;
    }
    
    return 'البيانات المدخلة موجودة مسبقاً';
  }

  private getTableDisplayName(tableName?: string): string {
    const tableNames: Record<string, string> = {
      'users': 'المستخدمين',
      'projects': 'المشاريع',
      'workers': 'العمال',
      'suppliers': 'الموردين',
      'materials': 'المواد',
      'material_purchases': 'مشتريات المواد',
      'worker_attendance': 'حضور العمال',
      'fund_transfers': 'تحويلات العهدة',
      'transportation_expenses': 'مصاريف المواصلات',
      'worker_transfers': 'تحويلات العمال',
      'daily_expense_summaries': 'ملخص المصاريف اليومية'
    };
    
    return tableNames[tableName || ''] || tableName || 'غير محدد';
  }

  private getFieldDisplayName(fieldName?: string): string {
    const fieldNames: Record<string, string> = {
      'email': 'البريد الإلكتروني',
      'name': 'الاسم',
      'phone': 'رقم الهاتف',
      'password': 'كلمة المرور',
      'title': 'العنوان',
      'description': 'الوصف',
      'amount': 'المبلغ',
      'date': 'التاريخ',
      'project_id': 'المشروع',
      'worker_id': 'العامل',
      'material_id': 'المادة',
      'supplier_id': 'المورد'
    };
    
    return fieldNames[fieldName || ''] || fieldName || '';
  }

  private mapSeverityToPriority(severity: string): number {
    const priorityMap: Record<string, number> = {
      'critical': 1,
      'high': 2,
      'medium': 3,
      'low': 4
    };
    
    return priorityMap[severity] || 3;
  }

  /**
   * إحصائيات الأخطاء
   */
  async getErrorStatistics(): Promise<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    errorsByTable: Record<string, number>;
    recentErrors: number;
    resolvedErrors: number;
  }> {
    try {
      await this.ensureErrorTablesExist();
      
      const [
        totalResult,
        typeResult,
        severityResult,
        tableResult,
        recentResult,
        resolvedResult
      ] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as count FROM error_logs`),
        db.execute(sql`SELECT error_type, COUNT(*) as count FROM error_logs GROUP BY error_type ORDER BY count DESC`),
        db.execute(sql`SELECT severity, COUNT(*) as count FROM error_logs GROUP BY severity`),
        db.execute(sql`SELECT table_name, COUNT(*) as count FROM error_logs GROUP BY table_name ORDER BY count DESC LIMIT 10`),
        db.execute(sql`SELECT COUNT(*) as count FROM error_logs WHERE created_at >= NOW() - INTERVAL '24 hours'`),
        db.execute(sql`SELECT COUNT(*) as count FROM error_logs WHERE status = 'resolved'`)
      ]);
      
      return {
        totalErrors: Number(totalResult.rows[0]?.count || 0),
        errorsByType: Object.fromEntries(typeResult.rows.map(r => [r.error_type, Number(r.count)])),
        errorsBySeverity: Object.fromEntries(severityResult.rows.map(r => [r.severity, Number(r.count)])),
        errorsByTable: Object.fromEntries(tableResult.rows.map(r => [r.table_name, Number(r.count)])),
        recentErrors: Number(recentResult.rows[0]?.count || 0),
        resolvedErrors: Number(resolvedResult.rows[0]?.count || 0)
      };
      
    } catch (error) {
      console.error('❌ خطأ في جلب إحصائيات الأخطاء:', error);
      return {
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        errorsByTable: {},
        recentErrors: 0,
        resolvedErrors: 0
      };
    }
  }

  /**
   * جلب قائمة الأخطاء التفصيلية
   */
  async getDetectedErrors(options: {
    limit?: number;
    offset?: number;
    severity?: string;
    errorType?: string;
    tableName?: string;
    status?: string;
  } = {}): Promise<{
    errors: Array<{
      id: string;
      errorType: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      tableName: string;
      columnName?: string;
      arabic_title?: string;
      description: string;
      friendlyMessage: string;
      status: string;
      fingerprint: string;
      metadata: any;
      created_at: string;
      updated_at: string;
    }>;
    total: number;
    hasMore: boolean;
  }> {
    try {
      await this.ensureErrorTablesExist();
      
      const {
        limit = 50,
        offset = 0,
        severity,
        errorType,
        tableName,
        status = 'unresolved'
      } = options;

      // جلب البيانات باستخدام SQL بسيط جداً - استخدام أعمدة الجدول الفعلية
      const result = await db.execute(sql`
        SELECT 
          id,
          error_type,
          severity,
          table_name,
          column_name,
          original_message,
          friendly_message,
          fingerprint,
          context,
          created_at,
          updated_at
        FROM error_logs 
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);

      const errors = result.rows.map((row: any) => ({
        id: row.id,
        errorType: row.error_type,
        severity: row.severity,
        tableName: row.table_name,
        columnName: row.column_name,
        arabic_title: `خطأ في ${row.table_name || 'النظام'}`, // عنوان تلقائي
        description: row.original_message, // استخدام original_message كـ description
        friendlyMessage: row.friendly_message,
        status: 'unresolved', // القيمة الافتراضية
        fingerprint: row.fingerprint,
        metadata: row.context ? (typeof row.context === 'string' ? JSON.parse(row.context) : row.context) : null,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));

      return {
        errors,
        total: errors.length,
        hasMore: false
      };

    } catch (error) {
      console.error('❌ خطأ في جلب قائمة الأخطاء التفصيلية:', error);
      return {
        errors: [],
        total: 0,
        hasMore: false
      };
    }
  }
}

// تصدير مثيل عام للاستخدام
export const smartErrorHandler = new SmartErrorHandler();