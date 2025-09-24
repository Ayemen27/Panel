
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq, and, gte } from 'drizzle-orm';
import { db } from '../db';
import { authUsers, authUserSessions, emailVerificationTokens } from '../../shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  emailVerifiedAt?: Date;
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  };
  requireEmailVerification?: boolean;
  message: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(payload: { userId: string; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

export function generateRefreshToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

export function verifyRefreshToken(token: string): any {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
}): Promise<{ success: boolean; user?: any; message: string }> {
  try {
    // التحقق من وجود المستخدم
    const existingUser = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, data.email))
      .limit(1);

    if (existingUser.length > 0) {
      return {
        success: false,
        message: 'البريد الإلكتروني مستخدم بالفعل'
      };
    }

    // تشفير كلمة المرور
    const hashedPassword = await hashPassword(data.password);

    // إنشاء المستخدم
    const newUser = await db
      .insert(authUsers)
      .values({
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'user',
        isActive: true,
      })
      .returning();

    // إنشاء رمز التحقق من البريد الإلكتروني
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ساعة

    await db.insert(emailVerificationTokens).values({
      userId: newUser[0].id,
      token: verificationToken,
      expiresAt,
    });

    return {
      success: true,
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        firstName: newUser[0].firstName,
        lastName: newUser[0].lastName,
        verificationToken,
      },
      message: 'تم إنشاء الحساب بنجاح. يرجى التحقق من بريدك الإلكتروني'
    };

  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      message: 'حدث خطأ أثناء إنشاء الحساب'
    };
  }
}

export async function loginUser(
  email: string, 
  password: string,
  deviceInfo?: {
    userAgent?: string;
    ipAddress?: string;
  }
): Promise<LoginResult> {
  try {
    // البحث عن المستخدم
    const user = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, email))
      .limit(1);

    if (user.length === 0) {
      return {
        success: false,
        message: 'بيانات تسجيل الدخول غير صحيحة'
      };
    }

    const foundUser = user[0];

    // التحقق من حالة المستخدم
    if (!foundUser.isActive) {
      return {
        success: false,
        message: 'الحساب معطل. يرجى التواصل مع المدير'
      };
    }

    // التحقق من كلمة المرور
    const isPasswordValid = await verifyPassword(password, foundUser.password);
    if (!isPasswordValid) {
      return {
        success: false,
        message: 'بيانات تسجيل الدخول غير صحيحة'
      };
    }

    // التحقق من تفعيل البريد الإلكتروني
    if (!foundUser.emailVerifiedAt) {
      return {
        success: false,
        requireEmailVerification: true,
        message: 'يجب تفعيل البريد الإلكتروني قبل تسجيل الدخول'
      };
    }

    // إنشاء الرموز المميزة
    const sessionToken = crypto.randomUUID();
    const accessToken = generateAccessToken({
      userId: foundUser.id,
      email: foundUser.email,
      role: foundUser.role
    });
    const refreshToken = generateRefreshToken({
      userId: foundUser.id,
      email: foundUser.email
    });

    // حفظ الجلسة
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 أيام
    await db.insert(authUserSessions).values({
      userId: foundUser.id,
      sessionToken,
      userAgent: deviceInfo?.userAgent,
      ipAddress: deviceInfo?.ipAddress,
      expiresAt,
    });

    // تحديث آخر تسجيل دخول
    await db
      .update(authUsers)
      .set({ lastLogin: new Date() })
      .where(eq(authUsers.id, foundUser.id));

    return {
      success: true,
      user: {
        id: foundUser.id,
        email: foundUser.email,
        firstName: foundUser.firstName,
        lastName: foundUser.lastName,
        role: foundUser.role,
        isActive: foundUser.isActive,
        emailVerifiedAt: foundUser.emailVerifiedAt,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresAt,
      },
      message: 'تم تسجيل الدخول بنجاح'
    };

  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'حدث خطأ أثناء تسجيل الدخول'
    };
  }
}

export async function verifyEmailToken(userId: string, token: string): Promise<{ success: boolean; message: string }> {
  try {
    const verificationRecord = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          eq(emailVerificationTokens.token, token),
          gte(emailVerificationTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (verificationRecord.length === 0) {
      return {
        success: false,
        message: 'رمز التحقق غير صالح أو منتهي الصلاحية'
      };
    }

    if (verificationRecord[0].usedAt) {
      return {
        success: false,
        message: 'تم استخدام رمز التحقق مسبقاً'
      };
    }

    // تفعيل البريد الإلكتروني
    await db
      .update(authUsers)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(authUsers.id, userId));

    // تحديد الرمز كمستخدم
    await db
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, verificationRecord[0].id));

    return {
      success: true,
      message: 'تم تفعيل البريد الإلكتروني بنجاح'
    };

  } catch (error) {
    console.error('Email verification error:', error);
    return {
      success: false,
      message: 'حدث خطأ أثناء التحقق من البريد الإلكتروني'
    };
  }
}

export async function refreshUserToken(refreshToken: string): Promise<{ success: boolean; accessToken?: string; message: string }> {
  try {
    const decoded = verifyRefreshToken(refreshToken);
    
    const user = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.id, decoded.userId))
      .limit(1);

    if (user.length === 0 || !user[0].isActive) {
      return {
        success: false,
        message: 'المستخدم غير موجود أو معطل'
      };
    }

    const newAccessToken = generateAccessToken({
      userId: user[0].id,
      email: user[0].email,
      role: user[0].role
    });

    return {
      success: true,
      accessToken: newAccessToken,
      message: 'تم تجديد الرمز بنجاح'
    };

  } catch (error) {
    console.error('Token refresh error:', error);
    return {
      success: false,
      message: 'رمز التجديد غير صالح'
    };
  }
}
