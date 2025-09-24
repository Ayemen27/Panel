import { SecureDataFetcher } from "./secure-data-fetcher";
import { db } from "../db";
import { materialPurchases } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * 🔄 معالج خاص لهجرة البيانات المعقدة (JSON) في جدول material_purchases
 * 
 * يتعامل مع:
 * - البيانات الـ JSON المتداخلة
 * - التحويل الآمن للصيغ
 * - منع التكرار
 * - معالجة الأخطاء المتخصصة
 */
export class JsonMigrationHandler {
  private fetcher: SecureDataFetcher;

  constructor(connectionString: string) {
    this.fetcher = new SecureDataFetcher(connectionString);
  }

  /**
   * 🔍 تحليل شامل لجدول material_purchases
   */
  async analyzeMaterialPurchasesStructure(limit: number = 20): Promise<{
    totalRows: number;
    sampleData: any[];
    jsonFields: string[];
    dataTypes: { [key: string]: string[] };
    hasComplexJson: boolean;
    migrationStrategy: 'simple' | 'complex' | 'mixed';
    recommendations: string[];
  }> {
    console.log('🔍 [JSON Handler] بدء تحليل هيكل جدول material_purchases...');
    
    try {
      // جلب العدد الإجمالي
      const totalRows = await this.fetcher.getRowCount('material_purchases');
      console.log(`📊 [JSON Handler] إجمالي الصفوف: ${totalRows}`);

      if (totalRows === 0) {
        return {
          totalRows: 0,
          sampleData: [],
          jsonFields: [],
          dataTypes: {},
          hasComplexJson: false,
          migrationStrategy: 'simple',
          recommendations: ['الجدول فارغ - لا يحتاج معالجة خاصة']
        };
      }

      // جلب عينة من البيانات
      const sampleData = await this.fetcher.fetchData('material_purchases', { 
        limit: Math.min(limit, totalRows) 
      });

      console.log(`🔬 [JSON Handler] تحليل ${sampleData.length} عينة...`);

      // تحليل البيانات
      const jsonFields: string[] = [];
      const dataTypes: { [key: string]: string[] } = {};
      let hasComplexJson = false;

      sampleData.forEach((row, index) => {
        Object.entries(row).forEach(([fieldName, value]) => {
          // تسجيل نوع البيانات
          if (!dataTypes[fieldName]) {
            dataTypes[fieldName] = [];
          }

          const valueType = this.getDetailedType(value);
          if (!dataTypes[fieldName].includes(valueType)) {
            dataTypes[fieldName].push(valueType);
          }

          // فحص البيانات الـ JSON
          if (typeof value === 'object' && value !== null) {
            if (!jsonFields.includes(fieldName)) {
              jsonFields.push(fieldName);
              console.log(`🔍 [JSON Handler] عثر على بيانات JSON في الحقل: ${fieldName}`);
            }

            // تحديد مستوى التعقيد
            const complexity = this.analyzeJsonComplexity(value);
            if (complexity.isComplex) {
              hasComplexJson = true;
              console.log(`⚠️ [JSON Handler] بيانات JSON معقدة في ${fieldName} (الصف ${index + 1}):`, {
                depth: complexity.depth,
                arrayCount: complexity.arrayCount,
                objectCount: complexity.objectCount
              });
            }
          }
        });
      });

      // تحديد استراتيجية الهجرة
      let migrationStrategy: 'simple' | 'complex' | 'mixed' = 'simple';
      if (jsonFields.length > 0) {
        migrationStrategy = hasComplexJson ? 'complex' : 'mixed';
      }

      // تحضير التوصيات
      const recommendations = this.generateMigrationRecommendations({
        totalRows,
        jsonFields,
        hasComplexJson,
        migrationStrategy
      });

      const analysis = {
        totalRows,
        sampleData: sampleData.slice(0, 3), // عرض 3 عينات فقط
        jsonFields,
        dataTypes,
        hasComplexJson,
        migrationStrategy,
        recommendations
      };

      console.log('✅ [JSON Handler] تم تحليل الهيكل بنجاح:', {
        totalRows: analysis.totalRows,
        jsonFieldsCount: analysis.jsonFields.length,
        strategy: analysis.migrationStrategy
      });

      return analysis;

    } catch (error: any) {
      console.error('❌ [JSON Handler] فشل في تحليل الهيكل:', error);
      throw new Error(`فشل تحليل هيكل material_purchases: ${error.message}`);
    }
  }

  /**
   * 🔄 هجرة آمنة لجدول material_purchases مع معالجة JSON
   */
  async migrateMaterialPurchasesSafely(batchSize: number = 50): Promise<{
    totalProcessed: number;
    successfullyMigrated: number;
    errors: number;
    errorDetails: string[];
    duplicatesSkipped: number;
    jsonConversions: number;
  }> {
    console.log('🚀 [JSON Handler] بدء هجرة آمنة لجدول material_purchases...');

    const stats = {
      totalProcessed: 0,
      successfullyMigrated: 0,
      errors: 0,
      errorDetails: [] as string[],
      duplicatesSkipped: 0,
      jsonConversions: 0
    };

    try {
      const totalRows = await this.fetcher.getRowCount('material_purchases');
      console.log(`📊 [JSON Handler] إجمالي الصفوف للهجرة: ${totalRows}`);

      if (totalRows === 0) {
        console.log('ℹ️ [JSON Handler] لا توجد بيانات للهجرة');
        return stats;
      }

      // معالجة الدفعات
      const totalBatches = Math.ceil(totalRows / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const offset = batchIndex * batchSize;
        console.log(`📦 [JSON Handler] معالجة الدفعة ${batchIndex + 1}/${totalBatches} (الصفوف ${offset + 1}-${Math.min(offset + batchSize, totalRows)})`);

        try {
          const batchData = await this.fetcher.fetchData('material_purchases', {
            limit: batchSize,
            offset: offset,
            orderBy: 'id'
          });

          for (const row of batchData) {
            stats.totalProcessed++;
            
            try {
              // فحص التكرار أولاً
              const existingRecord = await db.select()
                .from(materialPurchases)
                .where(eq(materialPurchases.id, row.id))
                .limit(1);

              if (existingRecord.length > 0) {
                stats.duplicatesSkipped++;
                console.log(`⚠️ [JSON Handler] تم تخطي السجل المكرر: ${row.id}`);
                continue;
              }

              // معالجة البيانات JSON إذا وجدت
              const processedRow = await this.processJsonFields(row);
              if (processedRow.hadJsonConversions) {
                stats.jsonConversions++;
              }

              // إدراج السجل في القاعدة المحلية
              await db.insert(materialPurchases).values(processedRow.data);
              stats.successfullyMigrated++;

              if (stats.totalProcessed % 10 === 0) {
                console.log(`📈 [JSON Handler] تقدم: ${stats.totalProcessed}/${totalRows} (${Math.round(stats.totalProcessed / totalRows * 100)}%)`);
              }

            } catch (rowError: any) {
              stats.errors++;
              const errorMsg = `خطأ في الصف ${row.id}: ${rowError.message}`;
              stats.errorDetails.push(errorMsg);
              console.error(`❌ [JSON Handler] ${errorMsg}`);
            }
          }

        } catch (batchError: any) {
          stats.errors++;
          const errorMsg = `خطأ في الدفعة ${batchIndex + 1}: ${batchError.message}`;
          stats.errorDetails.push(errorMsg);
          console.error(`❌ [JSON Handler] ${errorMsg}`);
        }
      }

      console.log('✅ [JSON Handler] تم إكمال الهجرة:', stats);
      return stats;

    } catch (error: any) {
      console.error('❌ [JSON Handler] فشل في الهجرة العامة:', error);
      throw error;
    }
  }

  /**
   * 🔧 معالجة الحقول الـ JSON في السجل
   */
  private async processJsonFields(row: any): Promise<{
    data: any;
    hadJsonConversions: boolean;
  }> {
    const processedRow = { ...row };
    let hadJsonConversions = false;

    // فحص كل حقل للبحث عن JSON
    Object.entries(row).forEach(([fieldName, value]) => {
      if (typeof value === 'object' && value !== null) {
        hadJsonConversions = true;
        
        // تحويل JSON إلى string إذا لزم الأمر (بناءً على schema)
        if (['notes', 'description', 'metadata'].includes(fieldName.toLowerCase())) {
          processedRow[fieldName] = JSON.stringify(value);
          console.log(`🔄 [JSON Handler] تم تحويل ${fieldName} من JSON إلى string`);
        } else {
          // الحفاظ على JSON كما هو للحقول المدعومة
          processedRow[fieldName] = value;
        }
      }
    });

    // تحويل التواريخ والأرقام إلى الصيغة المناسبة
    if (processedRow.purchase_date) {
      processedRow.purchaseDate = processedRow.purchase_date;
      delete processedRow.purchase_date;
    }

    if (processedRow.invoice_date) {
      processedRow.invoiceDate = processedRow.invoice_date;
      delete processedRow.invoice_date;
    }

    // تحويل الأرقام
    ['quantity', 'unit_price', 'total_amount', 'paid_amount', 'remaining_amount'].forEach(field => {
      if (processedRow[field] !== undefined) {
        processedRow[field] = String(processedRow[field]);
      }
    });

    return {
      data: processedRow,
      hadJsonConversions
    };
  }

  /**
   * 🔍 تحليل تعقيد البيانات JSON
   */
  private analyzeJsonComplexity(obj: any, depth: number = 0): {
    isComplex: boolean;
    depth: number;
    arrayCount: number;
    objectCount: number;
  } {
    const stats = {
      isComplex: false,
      depth,
      arrayCount: 0,
      objectCount: 0
    };

    if (Array.isArray(obj)) {
      stats.arrayCount++;
      if (obj.length > 5) stats.isComplex = true;
      
      obj.forEach(item => {
        const subStats = this.analyzeJsonComplexity(item, depth + 1);
        stats.arrayCount += subStats.arrayCount;
        stats.objectCount += subStats.objectCount;
        if (subStats.isComplex) stats.isComplex = true;
        stats.depth = Math.max(stats.depth, subStats.depth);
      });
    } else if (typeof obj === 'object' && obj !== null) {
      stats.objectCount++;
      const keys = Object.keys(obj);
      if (keys.length > 10) stats.isComplex = true;
      
      keys.forEach(key => {
        const subStats = this.analyzeJsonComplexity(obj[key], depth + 1);
        stats.arrayCount += subStats.arrayCount;
        stats.objectCount += subStats.objectCount;
        if (subStats.isComplex) stats.isComplex = true;
        stats.depth = Math.max(stats.depth, subStats.depth);
      });
    }

    if (depth > 3) stats.isComplex = true;

    return stats;
  }

  /**
   * 📋 تحديد نوع البيانات المفصل
   */
  private getDetailedType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return `array[${value.length}]`;
    if (typeof value === 'object') return `object[${Object.keys(value).length}]`;
    if (typeof value === 'string') {
      if (value.length > 255) return 'long_string';
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date_string';
      return 'string';
    }
    return typeof value;
  }

  /**
   * 💡 توليد توصيات للهجرة
   */
  private generateMigrationRecommendations(analysis: {
    totalRows: number;
    jsonFields: string[];
    hasComplexJson: boolean;
    migrationStrategy: string;
  }): string[] {
    const recommendations = [];

    if (analysis.totalRows > 1000) {
      recommendations.push('استخدام دفعات صغيرة (50-100 سجل) لتجنب timeout');
    }

    if (analysis.jsonFields.length > 0) {
      recommendations.push(`معثور على حقول JSON: ${analysis.jsonFields.join(', ')}`);
      
      if (analysis.hasComplexJson) {
        recommendations.push('البيانات JSON معقدة - تطبيق تحويل خاص');
        recommendations.push('مراجعة Schema للحقول JSON قبل الهجرة');
      } else {
        recommendations.push('البيانات JSON بسيطة - يمكن الهجرة المباشرة');
      }
    } else {
      recommendations.push('لا توجد بيانات JSON معقدة - هجرة عادية');
    }

    switch (analysis.migrationStrategy) {
      case 'simple':
        recommendations.push('استراتيجية بسيطة: نسخ مباشر للبيانات');
        break;
      case 'mixed':
        recommendations.push('استراتيجية مختلطة: معالجة خاصة للحقول JSON');
        break;
      case 'complex':
        recommendations.push('استراتيجية معقدة: تحويل شامل للبيانات JSON');
        recommendations.push('اختبار دفعة صغيرة أولاً');
        break;
    }

    return recommendations;
  }

  /**
   * 🔌 قطع الاتصال
   */
  async disconnect(): Promise<void> {
    await this.fetcher.disconnect();
  }
}