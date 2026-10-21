import { User } from './user.model.js';
import { Session } from '../auth/session.model.js';
import { NotFoundError } from '../../core/errors/AppError.js';

export class UsersController {
  static async getMe(req, res, next) {
    try {
      const user = await User.findById(req.user._id);
      if (!user) throw new NotFoundError('User not found');

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateMe(req, res, next) {
    try {
      // Disallow updating sensitive fields (role, status, 2FA) via updateMe
      const allowedUpdates = ['fullName', 'phone', 'avatarUrl', 'address'];
      const updates = {};
      
      for (const field of allowedUpdates) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMySessions(req, res, next) {
    try {
      const sessions = await Session.find({
        userId: req.user._id,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      }).select('-refreshTokenHash');

      res.status(200).json({
        success: true,
        data: sessions
      });
    } catch (err) {
      next(err);
    }
  }

  static async revokeSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      const session = await Session.findOne({ _id: sessionId, userId: req.user._id });
      if (!session) throw new NotFoundError('Session not found');

      session.isRevoked = true;
      await session.save();

      res.status(200).json({
        success: true,
        message: 'Session revoked successfully'
      });
    } catch (err) {
      next(err);
    }
  }
}
