import { ForbiddenError } from '../errors/AppError.js';

/**
 * RBAC authorization middleware
 * @param  {...string} roles 
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('User not authenticated'));
    }

    if (req.user.role === 'superadmin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Access denied: Requires one of [${roles.join(', ')}] permissions`));
    }

    next();
  };
};

/**
 * Resource ownership validator middleware (anti-IDOR)
 * @param {Function} resourceOwnerExtractor Function (req) => Promise<string | ObjectId>
 */
export const authorizeOwner = (resourceOwnerExtractor) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new ForbiddenError('User not authenticated'));
      }

      if (['admin', 'superadmin'].includes(req.user.role)) {
        return next();
      }

      const ownerId = await resourceOwnerExtractor(req);
      if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
        return next(new ForbiddenError('You do not have permission to access or modify this resource'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};
