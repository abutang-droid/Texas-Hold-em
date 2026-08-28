import { query } from './pool.js';

export interface EconomyStats {
  totalUsers: number;
  totalChipsInCirculation: number;
  totalRakeCollected: number;
  handsPlayed: number;
  privateRoomsActive: number;
  botNetLoss: number;
  rechargeVolumeToday: number;
}

export async function getEconomyStats(): Promise<EconomyStats> {
  const [users, rake, hands, privateRooms, botLoss, rechargeToday] = await Promise.all([
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
    query<{ total: string }>(
      `SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::text AS total
       FROM chip_transactions WHERE type = 'BUY_IN' AND reference_id LIKE 'bot:%'`,
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_chips + bonus_chips), 0)::text AS total
       FROM recharge_orders WHERE status = 'COMPLETED' AND created_at >= CURRENT_DATE`,
    ),
  ]);

  return {
    totalUsers: Number(users.rows[0]?.count ?? 0),
    totalChipsInCirculation: Number(users.rows[0]?.chips ?? 0),
    totalRakeCollected: Number(rake.rows[0]?.total ?? 0),
    handsPlayed: Number(hands.rows[0]?.count ?? 0),
    privateRoomsActive: Number(privateRooms.rows[0]?.count ?? 0),
    botNetLoss: Number(botLoss.rows[0]?.total ?? 0),
    rechargeVolumeToday: Number(rechargeToday.rows[0]?.total ?? 0),
  };
}
