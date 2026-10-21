import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';

// General API Rate Limiter
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests, please slow down'
    }
  }
});

// Auth Sensitive Operations Limiter (Login, OTP, password reset)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts. Please try again after 15 minutes.'
    }
  }
});

// Booking Creation Limiter
export const bookingCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'BOOKING_RATE_LIMIT_EXCEEDED',
      message: 'Too many booking requests created recently'
    }
  }
});

// Chat Message Limiter
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'MESSAGE_RATE_LIMIT_EXCEEDED',
      message: 'Sending messages too rapidly. Please slow down.'
    }
  }
});
