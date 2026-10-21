import { v4 as uuidv4 } from 'uuid';
import { User } from '../users/user.model.js';
import { Session } from './session.model.js';
import { hashPassword, verifyPassword } from '../../core/security/password.js';
import {
  generateAccessToken,
  generateOpaqueRefreshToken,
  hashRefreshToken
} from '../../core/security/tokens.js';
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotpToken
} from '../../core/security/otp.js';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
} from '../../core/errors/AppError.js';
import { logger } from '../../core/logger/index.js';

export class AuthService {
  static async register({ email, password, fullName, phone, role = 'client', address, ipAddress, userAgent, deviceId }) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email,
      passwordHash,
      fullName,
      phone,
      role,
      address,
      status: role === 'provider' ? 'pending_verification' : 'active'
    });

    // Create session family
    const familyId = uuidv4();
    const rawRefreshToken = generateOpaqueRefreshToken();
    const refreshTokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await Session.create({
      userId: user._id,
      refreshTokenHash,
      familyId,
      deviceId: deviceId || 'default',
      ipAddress,
      userAgent,
      expiresAt
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      sessionId: session._id.toString()
    });

    return {
      user,
      accessToken,
      refreshToken: rawRefreshToken
    };
  }

  static async login({ email, password, totpCode, ipAddress, userAgent, deviceId }) {
    const user = await User.findOne({ email }).select('+passwordHash +twoFactorSecret');
    if (!user) {
      // Constant time check against enumeration
      await hashPassword('dummy_password_timing');
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.status === 'suspended') {
      throw new ForbiddenError('Account has been suspended', 'ACCOUNT_SUSPENDED');
    }

    const isMatch = await verifyPassword(user.passwordHash, password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!totpCode) {
        return {
          requiresTwoFactor: true,
          message: 'Two-factor authentication code required'
        };
      }

      const isValidTotp = verifyTotpToken(totpCode, user.twoFactorSecret);
      if (!isValidTotp) {
        throw new UnauthorizedError('Invalid two-factor authentication code', 'INVALID_2FA_CODE');
      }
    }

    user.lastLoginAt = new Date();
    await user.save();

    // Create session with new family
    const familyId = uuidv4();
    const rawRefreshToken = generateOpaqueRefreshToken();
    const refreshTokenHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await Session.create({
      userId: user._id,
      refreshTokenHash,
      familyId,
      deviceId: deviceId || 'default',
      ipAddress,
      userAgent,
      expiresAt
    });

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      sessionId: session._id.toString()
    });

    const userObj = user.toJSON();

    return {
      user: userObj,
      accessToken,
      refreshToken: rawRefreshToken
    };
  }

  /**
   * Rotating Refresh Token with Reuse Detection (Section 8.1)
   */
  static async refreshTokens({ refreshToken, ipAddress, userAgent }) {
    const incomingHash = hashRefreshToken(refreshToken);

    const session = await Session.findOne({ refreshTokenHash: incomingHash });

    if (!session) {
      throw new UnauthorizedError('Invalid refresh token', 'INVALID_TOKEN');
    }

    // REUSE DETECTION: If token was already revoked, someone is replaying an old token!
    if (session.isRevoked) {
      logger.warn(
        { userId: session.userId, familyId: session.familyId },
        'SECURITY ALERT: Revoked refresh token reuse attempt! Revoking entire session family.'
      );
      // Revoke all sessions in the entire family
      await Session.updateMany({ familyId: session.familyId }, { isRevoked: true });
      throw new UnauthorizedError('Compromised token reuse detected. All sessions revoked.', 'TOKEN_REUSE_DETECTED');
    }

    if (new Date() > session.expiresAt) {
      session.isRevoked = true;
      await session.save();
      throw new UnauthorizedError('Refresh token has expired', 'TOKEN_EXPIRED');
    }

    const user = await User.findById(session.userId);
    if (!user || user.status === 'suspended') {
      throw new UnauthorizedError('Account inactive or suspended');
    }

    // Invalidate current token
    session.isRevoked = true;
    await session.save();

    // Issue new token in same family
    const newRawRefreshToken = generateOpaqueRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const newSession = await Session.create({
      userId: user._id,
      refreshTokenHash: newRefreshTokenHash,
      familyId: session.familyId,
      deviceId: session.deviceId,
      ipAddress,
      userAgent,
      expiresAt: newExpiresAt
    });

    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      role: user.role,
      sessionId: newSession._id.toString()
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken
    };
  }

  static async logout(sessionId) {
    if (sessionId) {
      await Session.findByIdAndUpdate(sessionId, { isRevoked: true });
    }
    return { success: true };
  }

  static async logoutAll(userId) {
    await Session.updateMany({ userId }, { isRevoked: true });
    return { success: true };
  }

  static async setup2fa(userId) {
    const user = await User.findById(userId);
    if (!user) throw new BadRequestError('User not found');

    const secret = generateTotpSecret();
    const uri = generateTotpUri(user.email, secret);

    user.twoFactorSecret = secret;
    await user.save();

    return { secret, uri };
  }

  static async enable2fa(userId, totpCode) {
    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestError('2FA setup not initialized');
    }

    const isValid = verifyTotpToken(totpCode, user.twoFactorSecret);
    if (!isValid) {
      throw new BadRequestError('Invalid verification code');
    }

    user.twoFactorEnabled = true;
    await user.save();

    return { success: true, message: 'Two-factor authentication successfully activated' };
  }
}
