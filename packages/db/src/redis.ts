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
