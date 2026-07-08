import { Redis } from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/** Weekly profit leaderboard */
export async function addWeeklyProfit(userId: number, delta: number): Promise<void> {
  const key = 'lb:profit:week';
  const r = getRedis();
  await r.zincrby(key, delta, String(userId));
}

export async function getWeeklyProfitTop(limit = 10): Promise<Array<{ userId: number; score: number }>> {
  const r = getRedis();
  const rows = await r.zrevrange('lb:profit:week', 0, limit - 1, 'WITHSCORES');
  const result: Array<{ userId: number; score: number }> = [];
  for (let i = 0; i < rows.length; i += 2) {
    result.push({ userId: Number(rows[i]), score: Number(rows[i + 1]) });
  }
  return result;
}

/** Single-hand biggest pot win this week */
export async function addWeeklyBiggestPot(userId: number, winAmount: number): Promise<void> {
  if (winAmount <= 0) return;
  const key = 'lb:biggest:week';
  const r = getRedis();
  const current = await r.zscore(key, String(userId));
  const prev = current ? Number(current) : 0;
  if (winAmount > prev) {
    await r.zadd(key, winAmount, String(userId));
  }
}

export async function getWeeklyBiggestPotTop(
  limit = 10,
): Promise<Array<{ userId: number; score: number }>> {
  const r = getRedis();
  const rows = await r.zrevrange('lb:biggest:week', 0, limit - 1, 'WITHSCORES');
  const result: Array<{ userId: number; score: number }> = [];
  for (let i = 0; i < rows.length; i += 2) {
    result.push({ userId: Number(rows[i]), score: Number(rows[i + 1]) });
  }
  return result;
}

/** Reset weekly leaderboards (call from cron Monday 00:00) */
export async function resetWeeklyLeaderboards(): Promise<void> {
  const r = getRedis();
  await r.del('lb:profit:week', 'lb:biggest:week', 'lb:cache:dual');
}
