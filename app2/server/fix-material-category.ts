
import { db } from "./db";
import { materialPurchases, materials } from "../shared/schema";
import { eq } from "drizzle-orm";

async function fixMaterialCategory() {
  console.log('🔧 بدء إصلاح حقل materialCategory في جدول materialPurchases...');
  
  try {
    // 1. إضافة الأعمدة إذا لم تكن موجودة
    try {
      console.log('📝 إضافة عمود materialCategory إذا لم يكن موجوداً...');
      await db.execute(`ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS material_category TEXT`);
      console.log('✅ تم إضافة عمود materialCategory');
    } catch (error) {
      console.log('ℹ️ عمود materialCategory موجود مسبقاً');
    }

    try {
      console.log('📝 إضافة عمود materialUnit إذا لم يكن موجوداً...');
      await db.execute(`ALTER TABLE material_purchases ADD COLUMN IF NOT EXISTS material_unit TEXT`);
      console.log('✅ تم إضافة عمود materialUnit');
    } catch (error) {
      console.log('ℹ️ عمود materialUnit موجود مسبقاً');
    }

    // 2. جلب جميع المشتريات التي ليس لها فئة مادة
    console.log('🔍 جلب المشتريات التي تحتاج لتحديث...');
    const purchasesWithoutCategory = await db
      .select()
      .from(materialPurchases)
      .where(sql`material_category IS NULL OR material_category = ''`);

    console.log(`📊 تم العثور على ${purchasesWithoutCategory.length} مشترية تحتاج تحديث`);

    // 3. جلب جميع المواد المسجلة
    const allMaterials = await db.select().from(materials);
    console.log(`📦 تم جلب ${allMaterials.length} مادة من قاعدة البيانات`);

    // 4. تحديث كل مشترية
    let updatedCount = 0;
    for (const purchase of purchasesWithoutCategory) {
      // البحث عن مادة مطابقة
      const matchingMaterial = allMaterials.find(material => 
        material.name.toLowerCase().trim() === purchase.materialName?.toLowerCase().trim()
      );

      if (matchingMaterial) {
        // تحديث المشترية بفئة ووحدة المادة
        await db
          .update(materialPurchases)
          .set({
            materialCategory: matchingMaterial.category,
            materialUnit: matchingMaterial.unit
          })
          .where(eq(materialPurchases.id, purchase.id));
        
        console.log(`✅ تم تحديث مشترية "${purchase.materialName}" - الفئة: ${matchingMaterial.category}`);
        updatedCount++;
      } else {
        // إذا لم نجد مادة مطابقة، نحدث فقط materialUnit من unit
        if (purchase.unit && !purchase.materialUnit) {
          await db
            .update(materialPurchases)
            .set({
              materialUnit: purchase.unit
            })
            .where(eq(materialPurchases.id, purchase.id));
          
          console.log(`🔄 تم نسخ وحدة "${purchase.unit}" للمشترية "${purchase.materialName}"`);
          updatedCount++;
        }
        console.log(`⚠️ لم يتم العثور على مادة مطابقة لـ "${purchase.materialName}"`);
      }
    }

    console.log(`🎉 تم الانتهاء من الإصلاح! تم تحديث ${updatedCount} مشترية من أصل ${purchasesWithoutCategory.length}`);

  } catch (error: any) {
    console.error('❌ خطأ في إصلاح materialCategory:', error);
    throw error;
  }
}

// تشغيل الإصلاح
fixMaterialCategory()
  .then(() => {
    console.log('✅ تم إنجاز الإصلاح بنجاح');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ فشل الإصلاح:', error);
    process.exit(1);
  });
