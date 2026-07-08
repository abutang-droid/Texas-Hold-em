import { query } from './pool.js';
import type { UserRow } from './users.js';
import { withTransaction } from './pool.js';
import { deductChips } from './users.js';

export interface PrivateRoomRow {
  room_code: string;
  room_id: string;
  host_user_id: string;
  max_seats: number;
  small_blind: string;
  big_blind: string;
  buy_in_cap: string;
  status: string;
  created_at: Date;
}

const PERMISSION_FEE = 100;

export async function countOfficialHandsForUser(userId: number): Promise<number> {
  const res = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM hand_histories
     WHERE room_type = 'OFFICIAL' AND player_snapshot ? $1`,
    [String(userId)],
  );
  return Number(res.rows[0]?.count ?? 0);
}

export async function grantPrivateRoomPermission(
  userId: number,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<UserRow> {
  return withTransaction(async (client) => {
    const userRes = await client.query<UserRow>('SELECT * FROM users WHERE id = $1 FOR UPDATE', [
      userId,
    ]);
    const user = userRes.rows[0];
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.private_room_permission) return user;

    await deductChips(client, userId, PERMISSION_FEE, 'PRIVATE_FEE', `permission:${userId}`);
    await client.query(
      `UPDATE users SET private_room_permission = TRUE, private_room_permission_at = NOW() WHERE id = $1`,
      [userId],
    );
    await client.query(
      `INSERT INTO private_room_agreements (user_id, ip_address, user_agent) VALUES ($1, $2, $3)`,
      [userId, ipAddress, userAgent],
    );
    const updated = await client.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    return updated.rows[0];
  });
}

function randomRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createPrivateRoom(input: {
  hostUserId: number;
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  buyInCap: number;
}): Promise<PrivateRoomRow> {
  const roomId = `P${String(input.hostUserId).padStart(4, '0')}${Date.now().toString().slice(-5)}`;
  let code = randomRoomCode();
  for (let i = 0; i < 5; i += 1) {
    const exists = await query('SELECT 1 FROM private_rooms WHERE room_code = $1', [code]);
    if (exists.rowCount === 0) break;
    code = randomRoomCode();
  }
  const res = await query<PrivateRoomRow>(
    `INSERT INTO private_rooms (room_code, room_id, host_user_id, max_seats, small_blind, big_blind, buy_in_cap)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      code,
      roomId,
      input.hostUserId,
      input.maxSeats,
      input.smallBlind,
      input.bigBlind,
      input.buyInCap,
    ],
  );
  return res.rows[0];
}

export async function findPrivateRoomByCode(code: string): Promise<PrivateRoomRow | null> {
  const res = await query<PrivateRoomRow>(
    `SELECT * FROM private_rooms WHERE room_code = $1 AND status != 'DISSOLVED'`,
    [code],
  );
  return res.rows[0] ?? null;
}

export async function findPrivateRoomByRoomId(roomId: string): Promise<PrivateRoomRow | null> {
  const res = await query<PrivateRoomRow>(
    `SELECT * FROM private_rooms WHERE room_id = $1 AND status != 'DISSOLVED'`,
    [roomId],
  );
  return res.rows[0] ?? null;
}

export async function countActivePrivateRooms(): Promise<number> {
  const res = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM private_rooms WHERE status IN ('WAITING', 'PLAYING', 'PAUSED')`,
  );
  return Number(res.rows[0]?.count ?? 0);
}

export async function setPrivateRoomStatusByRoomId(roomId: string, status: string): Promise<void> {
  await query(`UPDATE private_rooms SET status = $1 WHERE room_id = $2`, [status, roomId]);
}

export async function setPrivateRoomStatus(roomCode: string, status: string): Promise<void> {
  await query(`UPDATE private_rooms SET status = $1 WHERE room_code = $2`, [status, roomCode]);
}
