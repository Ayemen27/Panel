import { Request, Response, NextFunction } from 'express';
import { User } from '@shared/schema';
import { ServiceContainer } from '../core/ServiceContainer';

// Enhanced AuthenticatedRequest interface
export interface AuthenticatedRequest extends Request {
  user?: User;
  body: any;
  params: any;
  query: any;
  services: ServiceContainer;
}

// Helper function to get user ID from request
export const getUserId = (req: AuthenticatedRequest): string | null => {
  return req.user?.id || null;
};

// Helper function to get user role from request
export const getUserRole = (req: AuthenticatedRequest): string => {
  return req.user?.role || 'user';
};

// Check if user has specific permission
export const hasPermission = (req: AuthenticatedRequest, permission: string): boolean => {
  if (!req.user) return false;
  return req.user.permissions?.includes(permission) || false;
};

// Enhanced authentication middleware
export const isAuthenticated = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  
  // Log authentication failure for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔒 Authentication failed for ${req.method} ${req.path}:`, {
      sessionExists: !!req.session,
      sessionID: req.sessionID || 'none',
      hasUser: !!req.user,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
      ip: req.ip
    });
  }
  
  res.status(401).json({ 
    error: 'Authentication required',
    code: 'UNAUTHORIZED'
  });
};

// Role-based authorization middleware
export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const userRole = req.user.role || 'user'; // Default to 'user' if role is null
    if (!allowedRoles.includes(userRole)) {
      console.warn(`🚫 Role authorization failed:`, {
        userRole,
        allowedRoles,
        userId: req.user.id,
        path: req.path
      });
      
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles,
        current: userRole
      });
    }

    next();
  };
};

// Permission-based authorization middleware
export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasRequiredPermission = requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasRequiredPermission) {
      console.warn(`🚫 Permission authorization failed:`, {
        userPermissions,
        requiredPermissions,
        userId: req.user.id,
        path: req.path
      });
      
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: requiredPermissions,
        current: userPermissions
      });
    }

    next();
  };
};

// Optional authentication middleware (allows both authenticated and non-authenticated requests)
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Always proceed, but authentication status will be available
  next();
};

// Admin-only middleware (shorthand for requireRole('admin'))
export const adminOnly = requireRole('admin');

// Moderator or admin middleware
export const moderatorOrAdmin = requireRole('moderator', 'admin');

// Self or admin middleware (user can access their own resources or admin can access any)
export const selfOrAdmin = (userIdParam: string = 'id') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const targetUserId = req.params[userIdParam];
    const currentUserId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (currentUserId === targetUserId || isAdmin) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Access denied - can only access own resources',
      code: 'FORBIDDEN'
    });
  };
};

// Middleware to ensure user is active
export const requireActiveUser = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  if (!req.user.isActive) {
    return res.status(403).json({ 
      error: 'Account is deactivated',
      code: 'ACCOUNT_DEACTIVATED'
    });
  }

  next();
};