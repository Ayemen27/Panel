/**
 * Rate limiter configuration for the application
 * Provides configurable rate limiting to protect against DDoS and brute force attacks
 */

import rateLimit from 'express-rate-limit';

// Global rate limiter - general API protection
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'تم تجاوز حد الطلبات. حاول مرة أخرى لاحقاً.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Store in memory (can be upgraded to Redis for production clusters)
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

// Authentication rate limiter - stricter for login attempts
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    error: 'تم تجاوز حد محاولات تسجيل الدخول. حاول مرة أخرى بعد 15 دقيقة.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API rate limiter - moderate for general API usage
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute for API endpoints
  message: {
    error: 'تم تجاوز حد طلبات API. حاول مرة أخرى بعد دقيقة.',
    code: 'API_RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// File upload rate limiter - very strict for file operations
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 file uploads per hour
  message: {
    error: 'تم تجاوز حد رفع الملفات. حاول مرة أخرى بعد ساعة.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});