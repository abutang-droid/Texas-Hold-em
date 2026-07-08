import type { PoolClient } from 'pg';
import type { SupportedLocale } from '@texas-holdem/shared';
import { query, withTransaction } from './pool.js';

export interface UserRow {
  id: number;
  account_type: string;
  nickname: string;
  avatar_url: string | null;
  chips_balance: string;
  total_exp: number;
  level: number;
  preferred_locale: SupportedLocale;
  device_id: string | null;
  private_room_permission: boolean;
  status: string;
}

const REGISTER_BONUS = 100;

export async function findUserById(id: number): Promise<UserRow | null> {
  const res = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function findGuestByDevice(deviceId: string): Promise<UserRow | null> {
  const res = await query<UserRow>(
    `SELECT * FROM users WHERE device_id = $1 AND account_type = 'GUEST' LIMIT 1`,
    [deviceId],
  );
  return res.rows[0] ?? null;
}

export async function createGuestUser(
  deviceId: string,
  nickname: string,
  locale: SupportedLocale,
): Promise<UserRow> {
  return withTransaction(async (client) => {
    const existing = await client.query<UserRow>(
      `SELECT * FROM users WHERE device_id = $1 AND account_type = 'GUEST' LIMIT 1`,
      [deviceId],
    );
    if (existing.rows[0]) return existing.rows[0];

    const userRes = await client.query<UserRow>(
      `INSERT INTO users (account_type, device_id, nickname, chips_balance, preferred_locale)
       VALUES ('GUEST', $1, $2, 0, $3)
       RETURNING *`,
      [deviceId, nickname, locale],
    );
    const user = userRes.rows[0];

    await client.query(
      `INSERT INTO chip_transactions (user_id, amount, balance_after, type, reference_id)
       VALUES ($1, $2, $2, 'EVENT_GIFT', 'REGISTER_BONUS')`,
      [user.id, REGISTER_BONUS],
    );
    await client.query(`UPDATE users SET chips_balance = $1 WHERE id = $2`, [REGISTER_BONUS, user.id]);

    const updated = await client.query<UserRow>('SELECT * FROM users WHERE id = $1', [user.id]);
    return updated.rows[0];
  });
}

export async function deductChips(
  client: PoolClient,
  userId: number,
  amount: number,
  type: string,
  referenceId: string,
): Promise<number> {
  const res = await client.query<UserRow>('SELECT chips_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
  const user = res.rows[0];
  if (!user) throw new Error('USER_NOT_FOUND');
  const balance = Number(user.chips_balance);
  if (balance < amount) throw new Error('INSUFFICIENT_CHIPS');
  const after = balance - amount;
  await client.query('UPDATE users SET chips_balance = $1 WHERE id = $2', [after, userId]);
  await client.query(
    `INSERT INTO chip_transactions (user_id, amount, balance_after, type, reference_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, -amount, after, type, referenceId],
  );
  return after;
}

export async function addChips(
  client: PoolClient,
  userId: number,
  amount: number,
  type: string,
  referenceId: string,
): Promise<number> {
  const res = await client.query<UserRow>('SELECT chips_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
  const user = res.rows[0];
  if (!user) throw new Error('USER_NOT_FOUND');
  const after = Number(user.chips_balance) + amount;
  await client.query('UPDATE users SET chips_balance = $1 WHERE id = $2', [after, userId]);
  await client.query(
    `INSERT INTO chip_transactions (user_id, amount, balance_after, type, reference_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, amount, after, type, referenceId],
  );
  return after;
}

export async function mockRecharge(
  userId: number,
  amount: number,
  requestId: string,
): Promise<number> {
  return withTransaction(async (client) => {
    const dup = await client.query(
      `SELECT id FROM chip_transactions WHERE reference_id = $1 AND type = 'RECHARGE'`,
      [requestId],
    );
    if (dup.rows.length > 0) {
      const u = await client.query<UserRow>('SELECT chips_balance FROM users WHERE id = $1', [userId]);
      return Number(u.rows[0]?.chips_balance ?? 0);
    }
    return addChips(client, userId, amount, 'RECHARGE', requestId);
  });
}

export async function cashOutChips(userId: number, amount: number, referenceId: string): Promise<number> {
  if (amount <= 0) {
    const u = await findUserById(userId);
    return Number(u?.chips_balance ?? 0);
  }
  return withTransaction((client) => addChips(client, userId, amount, 'CASH_OUT', referenceId));
}

export async function buyInChips(
  userId: number,
  amount: number,
  referenceId: string,
): Promise<number> {
  return withTransaction((client) => deductChips(client, userId, amount, 'BUY_IN', referenceId));
}

async function addExp(userId: number, exp: number): Promise<void> {
  await query(`UPDATE users SET total_exp = total_exp + $1 WHERE id = $2`, [exp, userId]);
}

export async function recordHandExp(userId: number, exp: number): Promise<void> {
  if (exp <= 0) return;
  await addExp(userId, exp);
  await query(
    `UPDATE users SET level = GREATEST(1, 1 + total_exp / 100) WHERE id = $1`,
    [userId],
  );
}
