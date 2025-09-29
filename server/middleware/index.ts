// Import middleware functions for use in this file
import {
  AuthenticatedRequest,
  getUserId,
  getUserRole,
  hasPermission,
  isAuthenticated,
  requireRole,
  requirePermission,
  optionalAuth,
  adminOnly,
  moderatorOrAdmin,
  selfOrAdmin,
  requireActiveUser
} from './auth.middleware';

import {
  ValidationTarget,
  ValidationOptions,
  validate,
  validateBody,
  validateParams,
  validateQuery,
  validateHeaders,
  validateMultiple,
  sanitizeInput,
  validateFileUpload
} from './validation.middleware';

import {
  ErrorType,
  ApiError,
  createApiError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationError,
  authenticationError,
  authorizationError,
  notFoundError,
  conflictError,
  rateLimitError
} from './error.middleware';

// Re-export everything for external use
export {
  // Auth
  AuthenticatedRequest,
  getUserId,
  getUserRole,
  hasPermission,
  isAuthenticated,
  requireRole,
  requirePermission,
  optionalAuth,
  adminOnly,
  moderatorOrAdmin,
  selfOrAdmin,
  requireActiveUser,
  // Validation
  ValidationTarget,
  ValidationOptions,
  validate,
  validateBody,
  validateParams,
  validateQuery,
  validateHeaders,
  validateMultiple,
  sanitizeInput,
  validateFileUpload,
  // Error handling
  ErrorType,
  ApiError,
  createApiError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationError,
  authenticationError,
  authorizationError,
  notFoundError,
  conflictError,
  rateLimitError
};

// Re-export commonly used middleware combinations
export const commonMiddleware = {
  // Authentication combinations
  auth: {
    required: isAuthenticated,
    optional: optionalAuth,
    adminOnly: [isAuthenticated, adminOnly],
    moderatorOrAdmin: [isAuthenticated, moderatorOrAdmin],
    activeUser: [isAuthenticated, requireActiveUser]
  },
  
  // Validation combinations
  validation: {
    body: validateBody,
    params: validateParams,
    query: validateQuery,
    headers: validateHeaders,
    multiple: validateMultiple,
    sanitize: sanitizeInput
  },
  
  // Error handling
  error: {
    handler: errorHandler,
    notFound: notFoundHandler,
    async: asyncHandler
  }
};

// Export default middleware stack for common routes
export const defaultMiddleware = [
  sanitizeInput,
  isAuthenticated,
  requireActiveUser
];

// Export admin middleware stack
export const adminMiddleware = [
  sanitizeInput,
  isAuthenticated,
  requireActiveUser,
  adminOnly
];

// Export public middleware stack (no auth required)
export const publicMiddleware = [
  sanitizeInput
];