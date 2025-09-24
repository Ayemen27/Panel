/**
 * مسارات المصادقة - تسجيل الدخول والخروج والتسجيل
 * Authentication Routes - Login, Register, Logout
 */

import express from 'express';
import { Request, Response } from 'express';
import { db } from '../../db.js';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, generateTokenPair } from '../../auth/jwt-utils.js';
import { sendVerificationEmail, verifyEmailToken } from '../../services/email-service.js';

export const authRouter = express.Router();

/**
 * 🔐 تسجيل الدخول
 * POST /api/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    console.log('🔐 [AUTH] محاولة تسجيل دخول:', { email: req.body.email, timestamp: new Date().toISOString() });
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('❌ [AUTH] بيانات ناقصة - البريد أو كلمة المرور مفقودة');
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    // البحث عن المستخدم في قاعدة البيانات (case insensitive)
    const userResult = await db.execute(sql`
      SELECT id, email, password, first_name, last_name, email_verified_at, created_at
      FROM users 
      WHERE LOWER(email) = LOWER(${email})
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ [AUTH] المستخدم غير موجود:', email);
      return res.status(401).json({
        success: false,
        message: 'بيانات تسجيل الدخول غير صحيحة'
      });
    }

    const user = userResult.rows[0] as any;

    // التحقق من تفعيل البريد الإلكتروني - منع الدخول نهائياً
    if (!user.email_verified_at) {
      console.log('❌ [AUTH] البريد الإلكتروني غير مفعل للمستخدم:', email, '- منع تسجيل الدخول');
      
      // إرسال رمز تحقق جديد تلقائياً في الخلفية (بدون انتظار)
      const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || undefined;
      void sendVerificationEmail(
        user.id,
        user.email,
        req.ip,
        req.get('user-agent'),
        userFullName
      ).then(emailResult => {
        console.log('📧 [AUTH] تم إرسال رمز تحقق تلقائياً:', emailResult.success ? 'نجح' : 'فشل');
      }).catch(emailError => {
        console.error('❌ [AUTH] فشل في إرسال رمز التحقق التلقائي:', emailError);
      });

      return res.status(403).json({
        success: false,
        requireEmailVerification: true,
        message: 'يجب التحقق من بريدك الإلكتروني أولاً قبل تسجيل الدخول. تم إرسال رمز تحقق جديد',
        data: {
          userId: user.id,
          email: user.email,
          needsVerification: true
        }
      });
    }
    
    // التحقق من كلمة المرور
    const passwordMatch = await bcrypt.compare(password, String(user.password));
    
    if (!passwordMatch) {
      console.log('❌ [AUTH] كلمة مرور خاطئة للمستخدم:', email);
      return res.status(401).json({
        success: false,
        message: 'بيانات تسجيل الدخول غير صحيحة'
      });
    }

    // إنشاء JWT tokens مع حفظ الجلسة
    const tokenPair = await generateTokenPair(
      String(user.id),
      String(user.email),
      'user', // افتراضي
      req.ip,
      req.get('user-agent'),
      { deviceId: 'web-browser' }
    );
    
    console.log('✅ [AUTH] تم تسجيل الدخول بنجاح:', { 
      userId: user.id, 
      email: user.email,
      fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      emailVerified: !!user.email_verified_at
    });

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          role: user.role || 'user',
          createdAt: user.created_at,
          emailVerified: true
        },
        tokens: {
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [AUTH] خطأ في تسجيل الدخول:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء تسجيل الدخول',
      error: error.message
    });
  }
});

/**
 * 📝 تسجيل حساب جديد
 * POST /api/auth/register
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    console.log('📝 [AUTH] محاولة تسجيل حساب جديد:', { email: req.body.email });
    
    const { email, password, fullName } = req.body;
    
    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة (البريد، كلمة المرور، الاسم الكامل)'
      });
    }

    // التحقق من وجود المستخدم مسبقاً (case insensitive)
    const existingUser = await db.execute(sql`
      SELECT id FROM users WHERE LOWER(email) = LOWER(${email})
    `);

    if (existingUser.rows.length > 0) {
      console.log('❌ [AUTH] المستخدم موجود مسبقاً:', email);
      return res.status(409).json({
        success: false,
        message: 'المستخدم موجود بالفعل بهذا البريد الإلكتروني'
      });
    }

    // تشفير كلمة المرور
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // إنشاء المستخدم الجديد
    // تقسيم fullName إلى first_name و last_name
    const names = fullName.trim().split(/\s+/);
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ') || '';
    
    const newUserResult = await db.execute(sql`
      INSERT INTO users (email, password, first_name, last_name, created_at)
      VALUES (${email}, ${hashedPassword}, ${firstName}, ${lastName}, NOW())
      RETURNING id, email, first_name, last_name, created_at
    `);

    const newUser = newUserResult.rows[0] as any;

    console.log('✅ [AUTH] تم إنشاء حساب جديد:', { 
      userId: newUser.id, 
      email: newUser.email,
      fullName: `${newUser.first_name || ''} ${newUser.last_name || ''}`.trim()
    });

    // إرسال رمز التحقق من البريد الإلكتروني في الخلفية (بدون انتظار)
    void sendVerificationEmail(
      newUser.id,
      newUser.email,
      req.ip,
      req.get('user-agent'),
      fullName  // تمرير الاسم مباشرة من نموذج التسجيل - بدون استعلام إضافي
    ).then(emailResult => {
      console.log('📧 [AUTH] نتيجة إرسال بريد التحقق:', emailResult);
    }).catch(emailError => {
      console.error('❌ [AUTH] فشل في إرسال بريد التحقق:', emailError);
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب',
      requireEmailVerification: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: `${newUser.first_name || ''} ${newUser.last_name || ''}`.trim(),
          createdAt: newUser.created_at
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [AUTH] خطأ في تسجيل حساب جديد:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء إنشاء الحساب',
      error: error.message
    });
  }
});

/**
 * 🚪 تسجيل الخروج
 * POST /api/auth/logout
 */
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    console.log('🚪 [AUTH] تسجيل خروج المستخدم');
    
    // في المستقبل يمكن إضافة blacklist للـ tokens
    // أو إلغاء refresh token من قاعدة البيانات
    
    res.json({
      success: true,
      message: 'تم تسجيل الخروج بنجاح'
    });

  } catch (error: any) {
    console.error('❌ [AUTH] خطأ في تسجيل الخروج:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تسجيل الخروج',
      error: error.message
    });
  }
});

/**
 * 🔄 تجديد Access Token
 * POST /api/auth/refresh
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    console.log('🔄 [AUTH] طلب تجديد Access Token');
    
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token مطلوب'
      });
    }

    // التحقق من صحة refresh token
    try {
      const decoded = await verifyRefreshToken(refreshToken) as any;
      
      if (!decoded) {
        console.log('❌ [AUTH] Refresh token غير صالح');
        return res.status(401).json({
          success: false,
          message: 'Refresh token غير صالح'
        });
      }

      // البحث عن المستخدم مرة أخرى للتأكد
      const userResult = await db.execute(sql`
        SELECT id, email, first_name, last_name, created_at
        FROM users 
        WHERE id = ${decoded.userId || decoded.id}
      `);

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'المستخدم غير موجود'
        });
      }

      const user = userResult.rows[0] as any;
      
      // إنشاء access token جديد
      const newAccessToken = generateAccessToken({
        userId: String(user.id),
        email: String(user.email),
        role: 'user'
      });
    
      console.log('✅ [AUTH] تم تجديد Access Token بنجاح:', { userId: user.id });

      res.json({
        success: true,
        message: 'تم تجديد Access Token بنجاح',
        data: {
          accessToken: newAccessToken
        }
      });

    } catch (tokenError: any) {
      console.log('❌ [AUTH] Refresh token غير صالح:', tokenError.message);
      return res.status(401).json({
        success: false,
        message: 'Refresh token غير صالح أو منتهي الصلاحية'
      });
    }

  } catch (error: any) {
    console.error('❌ [AUTH] خطأ في تجديد Token:', error);
    res.status(401).json({
      success: false,
      message: 'خطأ في تجديد Access Token',
      error: error.message
    });
  }
});

/**
 * 📧 تحقق من البريد الإلكتروني
 * POST /api/auth/verify-email
 */
authRouter.post('/verify-email', async (req: Request, res: Response) => {
  try {
    console.log('📧 [AUTH] طلب تحقق من البريد الإلكتروني');
    
    const { userId, code } = req.body;
    
    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        message: 'معرف المستخدم ورمز التحقق مطلوبان'
      });
    }

    // التحقق من الرمز
    const result = await verifyEmailToken(userId, code);
    
    if (result.success) {
      console.log('✅ [AUTH] تم التحقق من البريد بنجاح:', { userId });
      res.json({
        success: true,
        message: result.message
      });
    } else {
      console.log('❌ [AUTH] فشل في التحقق من البريد:', result.message);
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error: any) {
    console.error('❌ [AUTH] خطأ في التحقق من البريد:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء التحقق',
      error: error.message
    });
  }
});

/**
 * 🔄 إعادة إرسال رمز التحقق
 * POST /api/auth/resend-verification
 */
authRouter.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    console.log('🔄 [AUTH] طلب إعادة إرسال رمز التحقق');
    
    const { userId, email } = req.body;
    
    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        message: 'معرف المستخدم والبريد الإلكتروني مطلوبان'
      });
    }

    // إرسال رمز تحقق جديد في الخلفية (بدون انتظار)
    void sendVerificationEmail(
      userId,
      email,
      req.ip,
      req.get('user-agent')
    ).then(result => {
      console.log('✅ [AUTH] تم إعادة إرسال رمز التحقق بنجاح:', { userId, email, success: result.success });
    }).catch(error => {
      console.error('❌ [AUTH] فشل في إعادة إرسال رمز التحقق:', error);
    });
    
    // الرد فوراً دون انتظار
    console.log('🚀 [AUTH] تم استلام طلب إعادة الإرسال، سيتم الإرسال في الخلفية');
    res.json({
      success: true,
      message: 'تم استلام طلبك. سيتم إرسال رمز التحقق إلى بريدك الإلكتروني خلال لحظات'
    });

  } catch (error: any) {
    console.error('❌ [AUTH] خطأ في إعادة إرسال رمز التحقق:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم أثناء إعادة الإرسال',
      error: error.message
    });
  }
});

// ملاحظة: تم حذف endpoint /me من هنا لتجنب التضارب مع النسخة المحمية في routes/auth.ts

console.log('🔐 [AuthRouter] تم تهيئة مسارات المصادقة');

export default authRouter;