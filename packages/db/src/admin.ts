import type { PoolClient } from 'pg';
import { query, withTransaction } from './pool.js';
import type { UserRow } from './users.js';
import { addChips, deductChips } from './users.js';

export type UserStatus = 'ACTIVE' | 'FROZEN' | 'BANNED';

export async function searchUsers(q: string, limit = 20): Promise<UserRow[]> {
  const term = `%${q.trim()}%`;
  const id = Number(q);
  if (Number.isFinite(id) && id > 0) {
    const res = await query<UserRow>(
      `SELECT * FROM users
       WHERE id = $1 OR nickname ILIKE $2 OR device_id ILIKE $2
       ORDER BY id DESC LIMIT $3`,
      [id, term, limit],
    );
    return res.rows;
  }
  const res = await query<UserRow>(
    `SELECT * FROM users WHERE nickname ILIKE $1 OR device_id ILIKE $1 ORDER BY id DESC LIMIT $2`,
    [term, limit],
  );
  return res.rows;
}

export async function setUserStatus(userId: number, status: UserStatus): Promise<UserRow | null> {
  const res = await query<UserRow>(
    `UPDATE users SET status = $1 WHERE id = $2 RETURNING *`,
    [status, userId],
  );
  return res.rows[0] ?? null;
}

export async function adminAdjustChips(
  userId: number,
  amount: number,
  reason: string,
): Promise<number> {
  return withTransaction(async (client: PoolClient) => {
    const ref = `admin:${Date.now()}`;
    if (amount >= 0) {
      return addChips(client, userId, amount, 'ADMIN_ADJUST', ref);
    }
    return deductChips(client, userId, -amount, 'ADMIN_ADJUST', `${ref}:${reason.slice(0, 32)}`);
  });
}

export function verifyAdminKey(header?: string): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return false;
  const key = header?.replace(/^Bearer\s+/i, '').trim();
  return key === expected;
}

export async function adminGrantPrivatePermission(
  userId: number,
  granted: boolean,
): Promise<UserRow | null> {
  const res = await query<UserRow>(
    `UPDATE users SET private_room_permission = $1,
      private_room_permission_at = CASE WHEN $1 THEN NOW() ELSE private_room_permission_at END,
      updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [granted, userId],
  );
  return res.rows[0] ?? null;
}
