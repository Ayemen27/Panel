import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ServiceError } from '../core/ServiceError';
import { AuthenticatedRequest } from './auth.middleware';
import { logger } from '../utils/logger';

// Error types enum
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT_EXCEEDED',
  SERVICE = 'SERVICE_ERROR',
  DATABASE = 'DATABASE_ERROR',
  INTERNAL = 'INTERNAL_ERROR'
}

// Enhanced error interface
export interface ApiError extends Error {
  type?: ErrorType;
  code?: string;
  statusCode?: number;
  details?: any;
  field?: string;
  value?: any;
}

// Create API error helper
export const createApiError = (
  message: string,
  type: ErrorType = ErrorType.INTERNAL,
  statusCode: number = 500,
  details?: any
): ApiError => {
  const error = new Error(message) as ApiError;
  error.type = type;
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

// Error logging helper
const logError = (error: any, req: AuthenticatedRequest) => {
  const errorInfo = {
    message: error.message,
    type: error.type || 'UNKNOWN',
    statusCode: error.statusCode || 500,
    method: req.method,
    path: req.path,
    userId: req.user?.id || 'anonymous',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };

  if (error.statusCode >= 500) {
    logger.error(`Server Error: ${error.message}`, 'api', { metadata: errorInfo });
  } else if (error.statusCode >= 400) {
    logger.warn(`Client Error: ${error.message}`, 'api', { metadata: errorInfo });
  } else {
    logger.info(`Error Info: ${error.message}`, 'api', { metadata: errorInfo });
  }
};

// Main error handling middleware
export const errorHandler = (
  error: any, 
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) => {
  // Log the error
  logError(error, req);

  // Handle different error types
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: 'received' in err ? err.received : undefined
    }));

    return res.status(400).json({
      error: 'Validation failed',
      type: ErrorType.VALIDATION,
      details: validationErrors
    });
  }

  if (error instanceof ServiceError) {
    return res.status(error.statusCode || 500).json({
      error: error.message,
      type: ErrorType.SERVICE,
      code: error.code,
      details: error.details
    });
  }

  // Handle Passport.js authentication errors
  if (error.name === 'AuthenticationError') {
    return res.status(401).json({
      error: 'Authentication failed',
      type: ErrorType.AUTHENTICATION,
      code: 'AUTH_FAILED'
    });
  }

  // Handle database errors
  if (error.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      error: 'Resource already exists',
      type: ErrorType.CONFLICT,
      code: 'DUPLICATE_ENTRY'
    });
  }

  if (error.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({
      error: 'Referenced resource does not exist',
      type: ErrorType.VALIDATION,
      code: 'FOREIGN_KEY_VIOLATION'
    });
  }

  // Handle rate limiting errors
  if (error.type === 'RateLimitError') {
    return res.status(429).json({
      error: 'Too many requests',
      type: ErrorType.RATE_LIMIT,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: error.retryAfter
    });
  }

  // Handle file upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      type: ErrorType.VALIDATION,
      code: 'FILE_TOO_LARGE'
    });
  }

  // Handle CORS errors
  if (error.message && error.message.includes('CORS')) {
    return res.status(403).json({
      error: 'CORS policy violation',
      type: ErrorType.AUTHORIZATION,
      code: 'CORS_ERROR'
    });
  }

  // Handle API errors (custom)
  if (error.type && error.statusCode) {
    return res.status(error.statusCode).json({
      error: error.message,
      type: error.type,
      code: error.code,
      details: error.details
    });
  }

  // Default internal server error
  const statusCode = error.statusCode || 500;
  const response: any = {
    error: statusCode >= 500 ? 'Internal server error' : error.message || 'An error occurred',
    type: ErrorType.INTERNAL,
    code: 'INTERNAL_ERROR'
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
    response.details = error.details;
  }

  res.status(statusCode).json(response);
};

// 404 Not Found handler
export const notFoundHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const error = createApiError(
    `Route ${req.method} ${req.path} not found`,
    ErrorType.NOT_FOUND,
    404
  );
  
  next(error);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error helper
export const validationError = (message: string, field?: string, value?: any) => {
  const error = createApiError(message, ErrorType.VALIDATION, 400);
  error.field = field;
  error.value = value;
  return error;
};

// Authentication error helper
export const authenticationError = (message: string = 'Authentication required') => {
  return createApiError(message, ErrorType.AUTHENTICATION, 401);
};

// Authorization error helper
export const authorizationError = (message: string = 'Insufficient permissions') => {
  return createApiError(message, ErrorType.AUTHORIZATION, 403);
};

// Not found error helper
export const notFoundError = (message: string = 'Resource not found') => {
  return createApiError(message, ErrorType.NOT_FOUND, 404);
};

// Conflict error helper
export const conflictError = (message: string = 'Resource conflict') => {
  return createApiError(message, ErrorType.CONFLICT, 409);
};

// Rate limit error helper
export const rateLimitError = (message: string = 'Too many requests', retryAfter?: number) => {
  const error = createApiError(message, ErrorType.RATE_LIMIT, 429);
  error.details = { retryAfter };
  return error;
};