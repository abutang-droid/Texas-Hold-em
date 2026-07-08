import { query } from './pool.js';
import { getConfigValue } from './system-config.js';

export interface ComplianceStatus {
  ageVerified: boolean;
  ageVerifiedAt: string | null;
  selfExcludedUntil: string | null;
  isSelfExcluded: boolean;
  migrationRequired: boolean;
  migrationAcknowledged: boolean;
  migrationMessage: string;
}

export async function declareAge(userId: number): Promise<void> {
  await query(`UPDATE users SET age_verified_at = NOW() WHERE id = $1 AND age_verified_at IS NULL`, [
    userId,
  ]);
}

export async function setSelfExclusion(userId: number, days: number): Promise<Date> {
  const d = Math.min(Math.max(Math.floor(days), 1), 365);
  const res = await query<{ self_excluded_until: Date }>(
    `UPDATE users SET self_excluded_until = NOW() + ($1 || ' days')::interval, status = 'FROZEN'
     WHERE id = $2 RETURNING self_excluded_until`,
    [String(d), userId],
  );
  return res.rows[0]!.self_excluded_until;
}

export async function acknowledgeBetaMigration(userId: number): Promise<void> {
  await query(`UPDATE users SET beta_migration_ack_at = NOW() WHERE id = $1`, [userId]);
}

export async function getComplianceStatus(
  userId: number,
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
): Promise<ComplianceStatus> {
  const res = await query<{
    age_verified_at: Date | null;
    self_excluded_until: Date | null;
    beta_migration_ack_at: Date | null;
  }>('SELECT age_verified_at, self_excluded_until, beta_migration_ack_at FROM users WHERE id = $1', [
    userId,
  ]);
  const row = res.rows[0];
  const migrationActive = (await getConfigValue('beta_migration_active')) === true
    || (await getConfigValue('beta_migration_active')) === 'true';
  const msgRaw = await getConfigValue('beta_migration_message');
  let migrationMessage = '';
  if (msgRaw && typeof msgRaw === 'object' && !Array.isArray(msgRaw)) {
    const m = msgRaw as Record<string, string>;
    migrationMessage = m[locale] ?? m['en-US'] ?? '';
  }

  const excludedUntil = row?.self_excluded_until ?? null;
  const isExcluded = excludedUntil !== null && excludedUntil.getTime() > Date.now();

  return {
    ageVerified: !!row?.age_verified_at,
    ageVerifiedAt: row?.age_verified_at?.toISOString() ?? null,
    selfExcludedUntil: excludedUntil?.toISOString() ?? null,
    isSelfExcluded: isExcluded,
    migrationRequired: migrationActive && !row?.beta_migration_ack_at,
    migrationAcknowledged: !!row?.beta_migration_ack_at,
    migrationMessage,
  };
}

export async function isUserPlayAllowed(userId: number): Promise<boolean> {
  const res = await query<{ self_excluded_until: Date | null; status: string }>(
    'SELECT self_excluded_until, status FROM users WHERE id = $1',
    [userId],
  );
  const row = res.rows[0];
  if (!row) return false;
  if (row.status === 'BANNED') return false;
  if (row.self_excluded_until && row.self_excluded_until.getTime() > Date.now()) return false;
  return true;
}

export async function setAdminRemark(userId: number, remark: string): Promise<void> {
  await query(`UPDATE users SET admin_remark = $1 WHERE id = $2`, [remark, userId]);
}
