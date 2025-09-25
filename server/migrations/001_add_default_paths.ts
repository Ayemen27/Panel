import { db } from '../db.js';
import { allowedPaths } from '@shared/schema';
import { sql } from 'drizzle-orm';

interface DefaultPath {
  path: string;
  type: 'allowed' | 'blocked';
  description: string;
  isActive: boolean;
}

const DEFAULT_PATHS: DefaultPath[] = [
  // Allowed paths
  {
    path: '/home',
    type: 'allowed',
    description: 'مجلد المستخدم الرئيسي',
    isActive: true,
  },
  {
    path: '/tmp',
    type: 'allowed',
    description: 'مجلد الملفات المؤقتة',
    isActive: true,
  },
  {
    path: '/var/log',
    type: 'allowed',
    description: 'مجلدات سجلات النظام',
    isActive: true,
  },
  {
    path: '/etc',
    type: 'allowed',
    description: 'ملفات تكوين النظام',
    isActive: true,
  },
  {
    path: '/workspace',
    type: 'allowed',
    description: 'مساحة العمل',
    isActive: true,
  },
  // Blocked paths for security
  {
    path: '/root',
    type: 'blocked',
    description: 'مجلد المدير - محظور للأمان',
    isActive: true,
  },
  {
    path: '/boot',
    type: 'blocked',
    description: 'ملفات الإقلاع - محظور للأمان',
    isActive: true,
  },
  {
    path: '/sys',
    type: 'blocked',
    description: 'ملفات النظام - محظور للأمان',
    isActive: true,
  },
  {
    path: '/proc',
    type: 'blocked',
    description: 'معلومات العمليات - محظورة',
    isActive: true,
  },
];

export async function addDefaultPaths(adminUserId?: string) {
  console.log('🚀 بدء إضافة المسارات الافتراضية...');
  
  try {
    // Get the first admin user if none provided
    let addedBy = adminUserId;
    if (!addedBy) {
      const adminUsers = await db.execute(
        sql`SELECT id FROM users WHERE role = 'admin' ORDER BY "created_at" ASC LIMIT 1`
      );
      
      if (adminUsers.rows.length > 0) {
        addedBy = adminUsers.rows[0].id as string;
        console.log(`📝 استخدام المستخدم الإداري: ${addedBy}`);
      } else {
        console.warn('⚠️ لم يتم العثور على مستخدم إداري، سيتم استخدام قيمة افتراضية');
        addedBy = 'system';
      }
    }

    // Check if default paths already exist
    const existingPaths = await db.execute(
      sql`SELECT path FROM allowed_paths WHERE path = ANY(${DEFAULT_PATHS.map(p => p.path)})`
    );

    const existingPathsSet = new Set(existingPaths.rows.map((row: any) => row.path));
    const pathsToAdd = DEFAULT_PATHS.filter(path => !existingPathsSet.has(path.path));

    if (pathsToAdd.length === 0) {
      console.log('✅ جميع المسارات الافتراضية موجودة بالفعل');
      return { success: true, message: 'جميع المسارات موجودة بالفعل', pathsAdded: 0 };
    }

    console.log(`📁 إضافة ${pathsToAdd.length} مسار جديد...`);

    // Insert new default paths
    const insertedPaths = [];
    for (const pathData of pathsToAdd) {
      try {
        const result = await db.insert(allowedPaths).values({
          path: pathData.path,
          type: pathData.type,
          description: pathData.description,
          isActive: pathData.isActive,
          addedBy: addedBy,
        }).returning();
        
        insertedPaths.push(result[0]);
        console.log(`✅ تم إضافة المسار: ${pathData.path} (${pathData.type})`);
      } catch (error) {
        console.error(`❌ خطأ في إضافة المسار ${pathData.path}:`, error);
      }
    }

    console.log(`🎉 تم إضافة ${insertedPaths.length} مسار بنجاح`);
    
    return {
      success: true,
      message: `تم إضافة ${insertedPaths.length} مسار افتراضي`,
      pathsAdded: insertedPaths.length,
      paths: insertedPaths
    };

  } catch (error) {
    console.error('❌ خطأ في إضافة المسارات الافتراضية:', error);
    throw error;
  }
}

export async function removeDefaultPaths() {
  console.log('🗑️ إزالة المسارات الافتراضية...');
  
  try {
    const pathsToRemove = DEFAULT_PATHS.map(p => p.path);
    
    const result = await db.execute(
      sql`DELETE FROM allowed_paths WHERE path = ANY(${pathsToRemove}) RETURNING path`
    );
    
    console.log(`🗑️ تم حذف ${result.rows.length} مسار افتراضي`);
    
    return {
      success: true,
      message: `تم حذف ${result.rows.length} مسار افتراضي`,
      pathsRemoved: result.rows.length
    };
    
  } catch (error) {
    console.error('❌ خطأ في حذف المسارات الافتراضية:', error);
    throw error;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addDefaultPaths()
    .then((result) => {
      console.log('✅ Migration completed successfully:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}