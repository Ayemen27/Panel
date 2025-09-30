import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AuthenticatedRequest } from './auth.middleware';

// Validation target enum
export enum ValidationTarget {
  BODY = 'body',
  PARAMS = 'params', 
  QUERY = 'query',
  HEADERS = 'headers'
}

// Validation options interface
export interface ValidationOptions {
  target?: ValidationTarget;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

// Create validation middleware for different targets
export const validate = (
  schema: ZodSchema, 
  target: ValidationTarget = ValidationTarget.BODY,
  options: ValidationOptions = {}
) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[target];
      
      // Parse and validate the data
      const validatedData = schema.parse(dataToValidate);
      
      // Replace the original data with validated data
      (req as any)[target] = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: 'received' in err ? err.received : undefined
        }));

        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          target,
          details: validationErrors
        });
      }

      // Handle unexpected errors
      console.error('Unexpected validation error:', error);
      return res.status(500).json({
        error: 'Internal validation error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

// Shorthand middleware functions
export const validateBody = (schema: ZodSchema, options?: ValidationOptions) => 
  validate(schema, ValidationTarget.BODY, options);

export const validateParams = (schema: ZodSchema, options?: ValidationOptions) => 
  validate(schema, ValidationTarget.PARAMS, options);

export const validateQuery = (schema: ZodSchema, options?: ValidationOptions) => 
  validate(schema, ValidationTarget.QUERY, options);

export const validateHeaders = (schema: ZodSchema, options?: ValidationOptions) => 
  validate(schema, ValidationTarget.HEADERS, options);

// Multi-target validation middleware
export const validateMultiple = (validations: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
}) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const errors: any[] = [];

    // Validate each target that has a schema
    for (const [target, schema] of Object.entries(validations)) {
      if (schema) {
        try {
          const dataToValidate = (req as any)[target];
          const validatedData = schema.parse(dataToValidate);
          (req as any)[target] = validatedData;
        } catch (error) {
          if (error instanceof ZodError) {
            const validationErrors = error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
              received: 'received' in err ? err.received : undefined,
              target
            }));
            errors.push(...validationErrors);
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      });
    }

    next();
  };
};

// Sanitization middleware (basic XSS protection)
export const sanitizeInput = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Basic HTML tag removal and script injection prevention
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    }
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    
    return value;
  };

  // Sanitize body, query, and params
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
};

// File upload validation middleware
export const validateFileUpload = (options: {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  maxFiles?: number;
  required?: boolean;
} = {}) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = [],
      maxFiles = 1,
      required = false
    } = options;

    const files = (req as any).files;
    
    if (required && (!files || (Array.isArray(files) && files.length === 0))) {
      return res.status(400).json({
        error: 'File upload is required',
        code: 'FILE_REQUIRED'
      });
    }

    if (!files) {
      return next(); // No files to validate
    }

    const fileArray = Array.isArray(files) ? files : [files];

    if (fileArray.length > maxFiles) {
      return res.status(400).json({
        error: `Too many files. Maximum allowed: ${maxFiles}`,
        code: 'TOO_MANY_FILES'
      });
    }

    for (const file of fileArray) {
      if (file.size > maxSize) {
        return res.status(400).json({
          error: `File too large. Maximum size: ${maxSize} bytes`,
          code: 'FILE_TOO_LARGE',
          maxSize
        });
      }

      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
          code: 'INVALID_FILE_TYPE',
          allowedTypes
        });
      }
    }

    next();
  };
};