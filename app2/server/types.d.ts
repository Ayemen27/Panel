/**
 * TypeScript type declarations للمشروع
 */

// إضافة user property إلى Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id?: string;
        userId: string;
        email: string;
        role: string;
        sessionId: string;
      };
    }
  }
}

export {};