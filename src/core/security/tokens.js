import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../config/env.js';

/**
 * Generate a short-lived Access Token JWT (15 mins)
 * @param {Object} payload 
 * @param {string} payload.userId
 * @param {string} payload.role
 * @param {string} payload.sessionId
 * @returns {string}
 */
export const generateAccessToken = ({ userId, role, sessionId }) => {
  return jwt.sign(
    {
      sub: userId,
      role,
      sid: sessionId,
      jti: uuidv4()
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN
    }
  );
};

/**
 * Verify and decode an Access Token JWT
 * @param {string} token 
 * @returns {Object}
 */
export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
};

/**
 * Generate an opaque, cryptographically strong Refresh Token (256 bits / 32 bytes hex)
 * @returns {string}
 */
export const generateOpaqueRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a refresh token using SHA-256 before persisting to database
 * @param {string} token 
 * @returns {string}
 */
export const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};
