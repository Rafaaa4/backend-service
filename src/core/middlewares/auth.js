import { verifyAccessToken } from '../security/tokens.js';
import { User } from '../../modules/users/user.model.js';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token is required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.sub);
    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    if (user.status === 'suspended') {
      throw new ForbiddenError('Account is suspended. Please contact support.');
    }

    req.user = user;
    req.sessionId = decoded.sid;
    next();
  } catch (err) {
    next(err);
  }
};
