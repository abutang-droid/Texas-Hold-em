import { query } from './pool.js';

export interface EconomyStats {
  totalUsers: number;
  totalChipsInCirculation: number;
  totalRakeCollected: number;
  handsPlayed: number;
  privateRoomsActive: number;
}

export async function getEconomyStats(): Promise<EconomyStats> {
  const [users, rake, hands, privateRooms] = await Promise.all([
    query<{ count: string; chips: string }>(
      `SELECT COUNT(*)::text AS count, COALESCE(SUM(chips_balance), 0)::text AS chips FROM users`,
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(rake_amount), 0)::text AS total FROM hand_histories`,
    ),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM hand_histories`),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM private_rooms WHERE status IN ('WAITING', 'PLAYING', 'PAUSED')`,
    ),
  ]);

  return {
    totalUsers: Number(users.rows[0]?.count ?? 0),
    totalChipsInCirculation: Number(users.rows[0]?.chips ?? 0),
    totalRakeCollected: Number(rake.rows[0]?.total ?? 0),
    handsPlayed: Number(hands.rows[0]?.count ?? 0),
    privateRoomsActive: Number(privateRooms.rows[0]?.count ?? 0),
  };
}
