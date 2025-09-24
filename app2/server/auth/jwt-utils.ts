/**
 * نظام JWT وإدارة الرموز المتقدم
 * يدعم Access Tokens, Refresh Tokens, وإدارة الجلسات
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq, and, lt, or, ne, gte } from 'drizzle-orm';
import { db } from '../db.js';
import { users, authUserSessions } from '../../shared/schema.js';
import { hashToken } from './crypto-utils.js';

// ملاحظة: تم تفعيل نظام الجلسات مع جدول authUserSessions

// إعدادات JWT - فقط من متغيرات البيئة للأمان
if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET و JWT_REFRESH_SECRET مطلوبان في متغيرات البيئة للأمان');
}

export const JWT_CONFIG = {
  accessTokenSecret: process.env.JWT_ACCESS_SECRET as string,
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET as string,
  accessTokenExpiry: '15m', // 15 دقيقة
  refreshTokenExpiry: '30d', // 30 يوم
  issuer: 'construction-management-app',
  algorithm: 'HS256' as const,
};

// واجهة بيانات JWT
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  iss?: string;
}

// واجهة نتيجة إنشاء الرموز
interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
}

/**
 * إنشاء Access Token مبسط
 */
export function generateAccessToken(payload: { userId: string; email: string; role: string }): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    JWT_CONFIG.accessTokenSecret,
    { 
      expiresIn: JWT_CONFIG.accessTokenExpiry,
      issuer: JWT_CONFIG.issuer
    } as jwt.SignOptions
  );
}

/**
 * إنشاء Refresh Token مبسط
 */
export function generateRefreshToken(payload: { userId: string; email: string }): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    JWT_CONFIG.refreshTokenSecret,
    { 
      expiresIn: JWT_CONFIG.refreshTokenExpiry,
      issuer: JWT_CONFIG.issuer
    } as jwt.SignOptions
  );
}

/**
 * إنشاء زوج من الرموز (Access + Refresh) مع حفظ الجلسة
 */
export async function generateTokenPair(
  userId: string,
  email: string,
  role: string,
  ipAddress?: string,
  userAgent?: string,
  deviceInfo?: any
): Promise<TokenPair> {
  const sessionId = crypto.randomUUID();
  const deviceId = deviceInfo?.deviceId || crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 دقيقة
  const refreshExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 يوم

  // إنشاء JWT payload مع sessionId
  const accessPayload = { userId, email, role, sessionId, type: 'access' as const };
  const refreshPayload = { userId, email, sessionId, type: 'refresh' as const };

  // إنشاء الرموز
  const accessToken = jwt.sign(accessPayload, JWT_CONFIG.accessTokenSecret, {
    expiresIn: JWT_CONFIG.accessTokenExpiry,
    issuer: JWT_CONFIG.issuer
  } as jwt.SignOptions);
  
  const refreshToken = jwt.sign(refreshPayload, JWT_CONFIG.refreshTokenSecret, {
    expiresIn: JWT_CONFIG.refreshTokenExpiry,
    issuer: JWT_CONFIG.issuer
  } as jwt.SignOptions);

  // إنشاء hash للرموز للحفظ الآمن
  const accessTokenHash = hashToken(accessToken);
  const refreshTokenHash = hashToken(refreshToken);

  try {
    // حفظ الجلسة في قاعدة البيانات
    await db.insert(authUserSessions).values({
      userId,
      deviceId,
      sessionToken: sessionId,
      deviceFingerprint: deviceInfo?.fingerprint,
      userAgent,
      ipAddress,
      locationData: deviceInfo?.location,
      deviceName: deviceInfo?.name,
      browserName: deviceInfo?.browser?.name,
      browserVersion: deviceInfo?.browser?.version,
      osName: deviceInfo?.os?.name,
      osVersion: deviceInfo?.os?.version,
      deviceType: deviceInfo?.type || 'web',
      loginMethod: 'password',
      accessTokenHash,
      refreshTokenHash,
      expiresAt: refreshExpiresAt, // الجلسة تنتهي مع refresh token
      isRevoked: false,
    });

    console.log('✅ [JWT] تم حفظ الجلسة بنجاح:', { userId, sessionId: sessionId.substring(0, 8) + '...' });
  } catch (error) {
    console.error('❌ [JWT] خطأ في حفظ الجلسة:', error);
    throw new Error('فشل في إنشاء جلسة المستخدم');
  }

  return {
    accessToken,
    refreshToken,
    sessionId,
    expiresAt,
    refreshExpiresAt,
  };
}

/**
 * التحقق من صحة Access Token مع فحص الجلسة في قاعدة البيانات
 */
export async function verifyAccessToken(token: string): Promise<{ success: boolean; user?: any } | null> {
  try {
    // فك تشفير JWT
    const payload = jwt.verify(token, JWT_CONFIG.accessTokenSecret, {
      issuer: JWT_CONFIG.issuer,
    }) as JWTPayload;

    // التحقق من نوع الرمز
    if (payload.type !== 'access') {
      return null;
    }

    // التحقق من وجود المستخدم في قاعدة البيانات
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (user.length === 0 || !user[0].isActive) {
      return null;
    }

    // التحقق من صحة الجلسة في قاعدة البيانات
    const tokenHash = hashToken(token);
    const session = await db
      .select()
      .from(authUserSessions)
      .where(
        and(
          eq(authUserSessions.userId, payload.userId),
          eq(authUserSessions.accessTokenHash, tokenHash),
          eq(authUserSessions.isRevoked, false),
          // التحقق من عدم انتهاء صلاحية الجلسة
          // نستخدم expiresAt للجلسة وليس للـ access token لأن access token ينتهي كل 15 دقيقة
          // ولكن الجلسة تستمر 30 يوم
          gte(authUserSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (session.length === 0) {
      // الجلسة غير موجودة أو ملغاة أو منتهية الصلاحية
      return null;
    }

    // تحديث آخر نشاط للجلسة
    await db
      .update(authUserSessions)
      .set({ lastActivity: new Date() })
      .where(eq(authUserSessions.id, session[0].id));

    return {
      success: true,
      user: {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        sessionId: session[0].sessionToken
      }
    };
  } catch (error) {
    // تقليل تسجيل الأخطاء الحساسة
    console.error('خطأ في التحقق من Access Token');
    return null;
  }
}

/**
 * التحقق من صحة Refresh Token - نسخة مبسطة
 */
export async function verifyRefreshToken(token: string): Promise<any | null> {
  try {
    // فك تشفير JWT
    const payload = jwt.verify(token, JWT_CONFIG.refreshTokenSecret, {
      issuer: JWT_CONFIG.issuer,
    }) as any;

    console.log('🔍 [JWT] فك تشفير refresh token:', { 
      hasUserId: !!payload.userId, 
      hasEmail: !!payload.email,
      hasType: !!payload.type,
      exp: payload.exp,
      iat: payload.iat 
    });

    // التحقق من نوع الرمز للأمان
    if (payload.type && payload.type !== 'refresh') {
      console.log('❌ [JWT] نوع رمز خاطئ:', payload.type);
      return null;
    }

    // إرجاع payload مع التحقق الأساسي
    return payload;

  } catch (error: any) {
    console.error('❌ [JWT] خطأ في التحقق من refresh token:', error.message);
    return null;
  }
}

/**
 * تجديد Access Token باستخدام Refresh Token مع تدوير الرموز
 */
/**
 * تجديد Access Token مبسط للتطوير (أسرع وأقل عمليات قاعدة بيانات)
 */
async function refreshAccessTokenDev(refreshToken: string): Promise<TokenPair | null> {
  const startTime = Date.now();
  console.log('🔄 [JWT-DEV] بدء تجديد مبسط للتطوير...');

  try {
    // فك تشفير refresh token
    const payload = jwt.verify(refreshToken, JWT_CONFIG.refreshTokenSecret, {
      issuer: JWT_CONFIG.issuer,
    }) as JWTPayload;

    if (payload.type !== 'refresh') {
      console.log('❌ [JWT-DEV] نوع رمز خاطئ:', payload.type);
      return null;
    }

    // استعلام مدمج واحد للمستخدم والجلسة
    const refreshTokenHash = hashToken(refreshToken);
    const userWithSession = await db
      .select({
        user: users,
        session: authUserSessions
      })
      .from(users)
      .leftJoin(authUserSessions, and(
        eq(authUserSessions.userId, users.id),
        eq(authUserSessions.refreshTokenHash, refreshTokenHash),
        eq(authUserSessions.isRevoked, false),
        gte(authUserSessions.expiresAt, new Date())
      ))
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (userWithSession.length === 0 || !userWithSession[0].user || !userWithSession[0].user.isActive) {
      console.log('❌ [JWT-DEV] مستخدم غير موجود أو غير نشط');
      return null;
    }

    if (!userWithSession[0].session) {
      console.log('❌ [JWT-DEV] جلسة غير موجودة أو منتهية');
      return null;
    }

    const user = userWithSession[0].user;
    const session = userWithSession[0].session;

    // إنشاء رموز جديدة - بدون تدوير معقد في التطوير
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 دقيقة
    const refreshExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 يوم

    // استخدام نفس sessionId لتجنب تعقيدات التدوير في التطوير
    const accessPayload = { userId: payload.userId, email: user.email, role: user.role, sessionId: payload.sessionId, type: 'access' as const };
    const refreshPayload = { userId: payload.userId, email: user.email, sessionId: payload.sessionId, type: 'refresh' as const };

    const newAccessToken = jwt.sign(accessPayload, JWT_CONFIG.accessTokenSecret, {
      expiresIn: JWT_CONFIG.accessTokenExpiry,
      issuer: JWT_CONFIG.issuer
    } as jwt.SignOptions);
    
    const newRefreshToken = jwt.sign(refreshPayload, JWT_CONFIG.refreshTokenSecret, {
      expiresIn: JWT_CONFIG.refreshTokenExpiry,
      issuer: JWT_CONFIG.issuer
    } as jwt.SignOptions);

    // تحديث بسيط للنشاط الأخير فقط (بدون تدوير hashes في التطوير)
    await db
      .update(authUserSessions)
      .set({
        lastActivity: new Date(),
      })
      .where(eq(authUserSessions.id, session.id));

    const duration = Date.now() - startTime;
    console.log(`✅ [JWT-DEV] تجديد مبسط مكتمل في ${duration}ms`);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionId: payload.sessionId,
      expiresAt,
      refreshExpiresAt,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [JWT-DEV] خطأ في التجديد بعد ${duration}ms:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * تجديد Access Token باستخدام Refresh Token (النسخة الكاملة للإنتاج)
 */
async function refreshAccessTokenProd(refreshToken: string): Promise<TokenPair | null> {
  const startTime = Date.now();
  console.log('🔄 [JWT-PROD] بدء تجديد كامل للإنتاج...');

  try {
    // فك تشفير refresh token
    const payload = jwt.verify(refreshToken, JWT_CONFIG.refreshTokenSecret, {
      issuer: JWT_CONFIG.issuer,
    }) as JWTPayload;

    // التحقق من نوع الرمز
    if (payload.type !== 'refresh') {
      return null;
    }

    // التحقق من وجود المستخدم
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (user.length === 0 || !user[0].isActive) {
      return null;
    }

    // التحقق من صحة refresh token في قاعدة البيانات
    const refreshTokenHash = hashToken(refreshToken);
    const session = await db
      .select()
      .from(authUserSessions)
      .where(
        and(
          eq(authUserSessions.userId, payload.userId),
          eq(authUserSessions.refreshTokenHash, refreshTokenHash),
          eq(authUserSessions.isRevoked, false),
          gte(authUserSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (session.length === 0) {
      // الجلسة غير موجودة أو ملغاة أو منتهية الصلاحية
      return null;
    }

    // إنشاء رموز جديدة
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 دقيقة
    const refreshExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 يوم

    const newSessionId = crypto.randomUUID();
    const accessPayload = { userId: payload.userId, email: user[0].email, role: user[0].role, sessionId: newSessionId, type: 'access' as const };
    const refreshPayload = { userId: payload.userId, email: user[0].email, sessionId: newSessionId, type: 'refresh' as const };

    const newAccessToken = jwt.sign(accessPayload, JWT_CONFIG.accessTokenSecret, {
      expiresIn: JWT_CONFIG.accessTokenExpiry,
      issuer: JWT_CONFIG.issuer
    } as jwt.SignOptions);
    
    const newRefreshToken = jwt.sign(refreshPayload, JWT_CONFIG.refreshTokenSecret, {
      expiresIn: JWT_CONFIG.refreshTokenExpiry,
      issuer: JWT_CONFIG.issuer
    } as jwt.SignOptions);

    // إنشاء hash للرموز الجديدة
    const newAccessTokenHash = hashToken(newAccessToken);
    const newRefreshTokenHash = hashToken(newRefreshToken);

    // تحديث الجلسة بالرموز الجديدة (تدوير الرموز)
    await db
      .update(authUserSessions)
      .set({
        sessionToken: newSessionId,
        accessTokenHash: newAccessTokenHash,
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: refreshExpiresAt,
        lastActivity: new Date(),
      })
      .where(eq(authUserSessions.id, session[0].id));

    const duration = Date.now() - startTime;
    console.log(`✅ [JWT-PROD] تم تدوير الرموز بنجاح في ${duration}ms:`, { 
      userId: payload.userId, 
      oldSessionId: session[0].sessionToken?.substring(0, 8) + '...',
      newSessionId: newSessionId.substring(0, 8) + '...'
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      sessionId: newSessionId,
      expiresAt,
      refreshExpiresAt,
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [JWT-PROD] خطأ في تجديد الرمز بعد ${duration}ms`);
    return null;
  }
}

/**
 * تجديد Access Token - يختار النسخة المناسبة حسب البيئة
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    return await refreshAccessTokenDev(refreshToken);
  } else {
    return await refreshAccessTokenProd(refreshToken);
  }
}

/**
 * إبطال جلسة بناءً على sessionId أو token hash
 */
export async function revokeToken(tokenOrSessionId: string, reason?: string): Promise<boolean> {
  try {
    // محاولة إبطال الجلسة بناءً على sessionId أولاً
    let updated = await db
      .update(authUserSessions)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason || 'manual_revoke',
      })
      .where(eq(authUserSessions.sessionToken, tokenOrSessionId));

    // إذا لم تنجح، جرب بناءً على token hashes
    if ((updated.rowCount || 0) === 0) {
      updated = await db
        .update(authUserSessions)
        .set({
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: reason || 'manual_revoke',
        })
        .where(
          or(
            eq(authUserSessions.accessTokenHash, tokenOrSessionId),
            eq(authUserSessions.refreshTokenHash, tokenOrSessionId),
            eq(authUserSessions.deviceId, tokenOrSessionId)
          )
        );
    }

    const success = (updated.rowCount || 0) > 0;
    if (success) {
      console.log('✅ [JWT] تم إبطال الجلسة بنجاح:', { 
        sessionId: tokenOrSessionId.length > 32 ? 'token' : tokenOrSessionId.substring(0, 8) + '...',
        reason
      });
    }

    return success;
  } catch (error) {
    console.error('خطأ في إبطال الجلسة');
    return false;
  }
}

/**
 * إبطال جميع جلسات المستخدم
 */
export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  try {
    const conditions = [
      eq(authUserSessions.userId, userId),
      eq(authUserSessions.isRevoked, false),
    ];

    if (exceptSessionId) {
      conditions.push(ne(authUserSessions.deviceId, exceptSessionId));
    }

    const updated = await db
      .update(authUserSessions)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'logout_all_devices',
      })
      .where(and(...conditions));

    return updated.rowCount || 0;
  } catch (error) {
    console.error('خطأ في إبطال جلسات المستخدم:', error);
    return 0;
  }
}

/**
 * تنظيف الجلسات المنتهية الصلاحية
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const now = new Date();
    
    const deleted = await db
      .delete(authUserSessions)
      .where(
        lt(authUserSessions.expiresAt, now)
      );

    console.log(`🧹 تم حذف ${deleted.rowCount || 0} جلسة منتهية الصلاحية`);
    return deleted.rowCount || 0;
  } catch (error) {
    console.error('خطأ في تنظيف الجلسات:', error);
    return 0;
  }
}

/**
 * الحصول على جلسات المستخدم النشطة
 */
export async function getUserActiveSessions(userId: string) {
  return db
    .select({
      sessionId: authUserSessions.deviceId,
      ipAddress: authUserSessions.ipAddress,
      userAgent: authUserSessions.browserName,
      deviceInfo: authUserSessions.deviceType,
      issuedAt: authUserSessions.createdAt,
      lastUsedAt: authUserSessions.lastActivity,
      expiresAt: authUserSessions.expiresAt,
    })
    .from(authUserSessions)
    .where(
      and(
        eq(authUserSessions.userId, userId),
        eq(authUserSessions.isRevoked, false)
      )
    )
    .orderBy(authUserSessions.lastActivity);
}

/**
 * فك تشفير رمز بدون التحقق من الصلاحية (للأغراض التشخيصية)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

// تم تصدير JWT_CONFIG في بداية الملف