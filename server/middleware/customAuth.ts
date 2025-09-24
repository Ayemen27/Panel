
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/customAuth';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { authUsers } from '../../shared/schema';

export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
    role: string;
    isActive: boolean;
  };
}

export const authenticateCustom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'رمز المصادقة مطلوب'
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    // التحقق من المستخدم في قاعدة البيانات
    const user = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.id, decoded.userId))
      .limit(1);

    if (user.length === 0 || !user[0].isActive) {
      return res.status(401).json({
        success: false,
        message: 'المستخدم غير موجود أو معطل'
      });
    }

    req.authUser = {
      id: user[0].id,
      email: user[0].email,
      firstName: user[0].firstName,
      lastName: user[0].lastName || undefined,
      role: user[0].role || 'user',
      isActive: user[0].isActive,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'رمز المصادقة غير صالح'
    });
  }
};

export const requireRole = (role: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({
        success: false,
        message: 'غير مصرح بالوصول'
      });
    }

    if (req.authUser.role !== role) {
      return res.status(403).json({
        success: false,
        message: 'صلاحيات غير كافية'
      });
    }

    next();
  };
};
