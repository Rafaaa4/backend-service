import { hashPassword, verifyPassword } from '../../src/core/security/password.js';
import { generateAccessToken, verifyAccessToken, generateOpaqueRefreshToken, hashRefreshToken } from '../../src/core/security/tokens.js';
import { generateTotpSecret, generateTotpUri, verifyTotpToken } from '../../src/core/security/otp.js';
import { filterChatContent } from '../../src/core/security/contentFilter.js';

describe('Core Security & Cryptography Unit Tests', () => {
  test('Argon2id hashes and verifies passwords correctly', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).toContain('$argon2id$');

    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hash, 'WrongPassword');
    expect(isInvalid).toBe(false);
  });

  test('JWT access tokens are issued and decoded with correct claims', () => {
    const payload = {
      userId: '65f1a2b3c4d5e6f7a8b9c0d1',
      role: 'client',
      sessionId: 'sess_12345'
    };

    const token = generateAccessToken(payload);
    expect(token).toBeDefined();

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.userId);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.sid).toBe(payload.sessionId);
    expect(decoded.jti).toBeDefined();
  });

  test('Opaque refresh tokens generate 64 hex characters (256-bit) and SHA-256 hash', () => {
    const token = generateOpaqueRefreshToken();
    expect(token).toHaveLength(64);

    const hash = hashRefreshToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
  });

  test('TOTP 2FA secret generation and verification', () => {
    const secret = generateTotpSecret();
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThan(10);

    const uri = generateTotpUri('user@example.tn', secret);
    expect(uri).toContain('otpauth://totp/');
  });

  test('Content filter masks phone numbers, emails, and external links before confirmation', () => {
    const sensitiveText = 'Contact me at mourad@gmail.com or call 20111222 or visit www.mysite.tn for direct deal';
    const { sanitized, hasContactInfo } = filterChatContent(sensitiveText);

    expect(hasContactInfo).toBe(true);
    expect(sanitized).not.toContain('mourad@gmail.com');
    expect(sanitized).not.toContain('20111222');
    expect(sanitized).toContain('[CONTACT MASQUÉ]');
    expect(sanitized).toContain('[NUMÉRO MASQUÉ]');
    expect(sanitized).toContain('[LIEN MASQUÉ]');
  });
});
