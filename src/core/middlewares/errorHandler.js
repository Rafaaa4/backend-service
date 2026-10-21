import { AppError } from '../errors/AppError.js';
import { logger } from '../logger/index.js';
import { env } from '../../config/env.js';

export const errorHandler = (err, req, res, next) => {
  const requestId = req.id || 'unknown';
  
  // If operational known error
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, `Server Error: ${err.message}`);
    } else {
      logger.warn({ code: err.code, message: err.message, requestId, details: err.details }, `Client Error: ${err.message}`);
    }

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || undefined,
        requestId
      }
    });
  }

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    logger.warn({ err, requestId }, 'Duplicate key conflict');
    const fields = Object.keys(err.keyPattern || {});
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_KEY',
        message: `A resource with the specified ${fields.join(', ')} already exists`,
        requestId
      }
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: err.message === 'jwt expired' ? 'Token has expired' : 'Invalid token signature',
        requestId
      }
    });
  }

  // Unhandled / system errors
  logger.error({ err, requestId }, 'Unhandled Exception');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
      requestId
    }
  });
};
