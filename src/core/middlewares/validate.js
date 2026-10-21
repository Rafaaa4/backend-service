import { ValidationError } from '../errors/AppError.js';

/**
 * Middleware factory for validating incoming request objects using Zod schemas
 * @param {import('zod').ZodSchema} schema 
 * @param {'body' | 'query' | 'params'} source 
 */
export const validate = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req[source]);
      req[source] = parsed; // Replace with sanitized/parsed data
      next();
    } catch (err) {
      if (err.errors) {
        const issues = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return next(new ValidationError('Validation failed for ' + source, issues));
      }
      next(err);
    }
  };
};
