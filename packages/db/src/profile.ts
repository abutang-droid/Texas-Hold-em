import { query } from './pool.js';
import type { UserRow } from './users.js';

export async function updateUserProfile(
  userId: number,
  patch: { nickname?: string; avatarUrl?: string | null },
): Promise<UserRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.nickname !== undefined) {
    sets.push(`nickname = $${idx++}`);
    values.push(patch.nickname.slice(0, 32));
  }
  if (patch.avatarUrl !== undefined) {
    sets.push(`avatar_url = $${idx++}`);
    values.push(patch.avatarUrl);
  }
  if (sets.length === 0) return null;

  values.push(userId);
  const res = await query<UserRow>(
    `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    values,
  );
  return res.rows[0] ?? null;
}

export async function setLeaderboardStealth(userId: number, enabled: boolean): Promise<void> {
  await query(
    `UPDATE users SET settings_json = COALESCE(settings_json, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify({ leaderboardStealth: enabled }), userId],
  );
}

export async function getUserSettings(userId: number): Promise<Record<string, unknown>> {
  const res = await query<{ settings_json: Record<string, unknown> | null }>(
    `SELECT settings_json FROM users WHERE id = $1`,
    [userId],
  );
  return res.rows[0]?.settings_json ?? {};
}
