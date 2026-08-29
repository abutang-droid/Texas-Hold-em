import { getRedis } from './redis.js';

const ROOM_IP_TTL_SEC = 3600;

function roomIpKey(roomId: string): string {
  return `room:${roomId}:player_ips`;
}

/** Returns conflicting userId if another seated account shares this IP. */
export async function findOfficialIpConflict(
  roomId: string,
  ip: string,
  excludeUserId: string,
): Promise<string | null> {
  if (!ip || ip === 'unknown') return null;
  const r = getRedis();
  const map = await r.hgetall(roomIpKey(roomId));
  for (const [uid, existingIp] of Object.entries(map)) {
    if (uid !== excludeUserId && existingIp === ip) return uid;
  }
  return null;
}

export async function registerOfficialRoomIp(
  roomId: string,
  userId: string,
  ip: string,
): Promise<void> {
  if (!ip || ip === 'unknown') return;
  const r = getRedis();
  const key = roomIpKey(roomId);
  await r.hset(key, userId, ip);
  await r.expire(key, ROOM_IP_TTL_SEC);
}

export async function clearOfficialRoomIp(roomId: string, userId: string): Promise<void> {
  const r = getRedis();
  const key = roomIpKey(roomId);
  await r.hdel(key, userId);
  if ((await r.hlen(key)) === 0) await r.del(key);
}
