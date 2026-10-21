import { authenticator } from 'otplib';
import { env } from '../../config/env.js';

/**
 * Generate a new 2FA Secret for TOTP
 * @returns {string} Base32 encoded secret
 */
export const generateTotpSecret = () => {
  return authenticator.generateSecret();
};

/**
 * Generate otpauth URL for QR code generation
 * @param {string} email 
 * @param {string} secret 
 * @returns {string}
 */
export const generateTotpUri = (email, secret) => {
  return authenticator.keyuri(email, env.TWO_FACTOR_APP_NAME, secret);
};

/**
 * Verify a TOTP token against secret
 * @param {string} token 6-digit TOTP code
 * @param {string} secret Base32 secret
 * @returns {boolean}
 */
export const verifyTotpToken = (token, secret) => {
  try {
    return authenticator.check(token, secret);
  } catch {
    return false;
  }
};
