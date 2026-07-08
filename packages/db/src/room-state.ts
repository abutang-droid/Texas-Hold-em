import { getRedis } from './redis.js';

const USER_ROOM_TTL_SEC = 3600;
const SNAPSHOT_TTL_SEC = 3600;

function userRoomKey(userId: number): string {
  return `user:${userId}:active_room`;
}

function roomSnapshotKey(roomId: string): string {
  return `room:${roomId}:snapshot`;
}

export async function setUserActiveRoom(userId: number, roomId: string): Promise<void> {
  const r = getRedis();
  await r.set(userRoomKey(userId), roomId, 'EX', USER_ROOM_TTL_SEC);
}

export async function getUserActiveRoom(userId: number): Promise<string | null> {
  const r = getRedis();
  return r.get(userRoomKey(userId));
}

export async function clearUserActiveRoom(userId: number): Promise<void> {
  const r = getRedis();
  await r.del(userRoomKey(userId));
}

export async function saveRoomSnapshot(roomId: string, snapshot: unknown): Promise<void> {
  const r = getRedis();
  await r.set(roomSnapshotKey(roomId), JSON.stringify(snapshot), 'EX', SNAPSHOT_TTL_SEC);
}

export async function getRoomSnapshot<T>(roomId: string): Promise<T | null> {
  const r = getRedis();
  const raw = await r.get(roomSnapshotKey(roomId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
