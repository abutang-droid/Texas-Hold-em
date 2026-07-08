import { findUserById } from './users.js';
import {
  getWeeklyProfitTop,
  getWeeklyBiggestPotTop,
  addWeeklyBiggestPot,
  getRedis,
} from './redis.js';
import { getConfigValue } from './system-config.js';

export interface LeaderboardEntry {
  userId: number;
  nickname: string;
  score: number;
}

export interface DualLeaderboard {
  profit: LeaderboardEntry[];
  biggestPot: LeaderboardEntry[];
  refreshedAt: string;
  refreshMinutes: number;
}

const CACHE_KEY = 'lb:cache:dual';

async function enrichTop(
  rows: Array<{ userId: number; score: number }>,
  stealthFilter: boolean,
): Promise<LeaderboardEntry[]> {
  const result: LeaderboardEntry[] = [];
  for (const row of rows) {
    const user = await findUserById(row.userId);
    if (!user) continue;
    if (stealthFilter) {
      const settings = user.settings_json as { leaderboardStealth?: boolean } | null;
      if (settings?.leaderboardStealth) continue;
    }
    result.push({
      userId: row.userId,
      nickname: user.nickname,
      score: row.score,
    });
  }
  return result;
}

export async function buildDualLeaderboard(limit = 10): Promise<DualLeaderboard> {
  const refreshMinutes = Number((await getConfigValue('leaderboard_refresh_minutes')) ?? 10);
  const [profitRaw, biggestRaw] = await Promise.all([
    getWeeklyProfitTop(limit + 5),
    getWeeklyBiggestPotTop(limit + 5),
  ]);
  const profit = (await enrichTop(profitRaw, true)).slice(0, limit);
  const biggestPot = (await enrichTop(biggestRaw, true)).slice(0, limit);
  const payload: DualLeaderboard = {
    profit,
    biggestPot,
    refreshedAt: new Date().toISOString(),
    refreshMinutes,
  };
  const r = getRedis();
  await r.setex(CACHE_KEY, refreshMinutes * 60, JSON.stringify(payload));
  return payload;
}

export async function getDualLeaderboard(limit = 10): Promise<DualLeaderboard> {
  const r = getRedis();
  const cached = await r.get(CACHE_KEY);
  if (cached) return JSON.parse(cached) as DualLeaderboard;
  return buildDualLeaderboard(limit);
}

export { addWeeklyBiggestPot };
