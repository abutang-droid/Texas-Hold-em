import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { SupportedLocale } from '@texas-holdem/shared';
import { withTransaction } from './pool.js';
import type { UserRow } from './users.js';

const REGISTER_BONUS = 100;
const MIN_PASSWORD_LEN = 8;

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LEN;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT_OPTS);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1]!, 'hex');
  const expected = Buffer.from(parts[2]!, 'hex');
  const hash = scryptSync(password, salt, 64, SCRYPT_OPTS);
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { query } = await import('./pool.js');
  const res = await query<UserRow>(`SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [
    normalizeEmail(email),
  ]);
  return res.rows[0] ?? null;
}

export async function registerWithEmail(opts: {
  email: string;
  password: string;
  nickname: string;
  locale: SupportedLocale;
  linkGuestUserId?: number;
}): Promise<UserRow> {
  const email = normalizeEmail(opts.email);
  if (!isValidEmail(email)) throw new Error('INVALID_EMAIL');
  if (!isValidPassword(opts.password)) throw new Error('WEAK_PASSWORD');

  return withTransaction(async (client) => {
    const dup = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email]);
    if (dup.rows.length > 0) throw new Error('EMAIL_TAKEN');

    const passwordHash = hashPassword(opts.password);

    if (opts.linkGuestUserId) {
      const guest = await client.query<UserRow>(
        `SELECT * FROM users WHERE id = $1 AND account_type = 'GUEST' FOR UPDATE`,
        [opts.linkGuestUserId],
      );
      if (guest.rows[0] && !guest.rows[0].email) {
        const updated = await client.query<UserRow>(
          `UPDATE users SET account_type = 'REGISTERED', email = $1, password_hash = $2, nickname = $3
           WHERE id = $4 RETURNING *`,
          [email, passwordHash, opts.nickname, opts.linkGuestUserId],
        );
        return updated.rows[0];
      }
    }

    const userRes = await client.query<UserRow>(
      `INSERT INTO users (account_type, email, password_hash, nickname, chips_balance, preferred_locale)
       VALUES ('REGISTERED', $1, $2, $3, 0, $4) RETURNING *`,
      [email, passwordHash, opts.nickname, opts.locale],
    );
    const user = userRes.rows[0];
    await client.query(
      `INSERT INTO chip_transactions (user_id, amount, balance_after, type, reference_id)
       VALUES ($1, $2, $2, 'EVENT_GIFT', 'REGISTER_BONUS')`,
      [user.id, REGISTER_BONUS],
    );
    await client.query(`UPDATE users SET chips_balance = $1 WHERE id = $2`, [REGISTER_BONUS, user.id]);
    const final = await client.query<UserRow>('SELECT * FROM users WHERE id = $1', [user.id]);
    return final.rows[0];
  });
}

export async function loginWithEmail(email: string, password: string): Promise<UserRow | null> {
  const user = await findUserByEmail(email);
  if (!user?.password_hash) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  if (user.status !== 'ACTIVE') throw new Error('ACCOUNT_BLOCKED');
  return user;
}
