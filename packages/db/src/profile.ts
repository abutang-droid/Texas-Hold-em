import { query } from './pool.js';
import type { UserRow } from './users.js';

export async function updateUserProfile(
  userId: number,
  patch: { nickname?: string; avatarUrl?: string | null },
): Promise<UserRow | null> {
  if (patch.nickname !== undefined) {
    const res = await query<UserRow>(
      `UPDATE users SET nickname = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [patch.nickname.slice(0, 32), userId],
    );
    return res.rows[0] ?? null;
  }
  if (patch.avatarUrl !== undefined) {
    const res = await query<UserRow>(
      `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [patch.avatarUrl, userId],
    );
    return res.rows[0] ?? null;
  }
  return null;
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
