import bcryptjs from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcryptjs.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash safely.
 */
export async function verifyPassword(password: string, hash?: string | null): Promise<boolean> {
  if (!hash || !password) return false;
  try {
    return await bcryptjs.compare(password, hash);
  } catch {
    return false;
  }
}
