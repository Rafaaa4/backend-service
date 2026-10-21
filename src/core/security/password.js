import argon2 from 'argon2';

/**
 * Hash a password using Argon2id with memory ≥ 19MB, timeCost ≥ 2 as required in PLAN_HOME_SERVICES.md
 * @param {string} password 
 * @returns {Promise<string>}
 */
export const hashPassword = async (password) => {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB memory
    timeCost: 3,         // 3 iterations
    parallelism: 1
  });
};

/**
 * Verify a plaintext password against an Argon2id hash
 * @param {string} hash 
 * @param {string} password 
 * @returns {Promise<boolean>}
 */
export const verifyPassword = async (hash, password) => {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};
