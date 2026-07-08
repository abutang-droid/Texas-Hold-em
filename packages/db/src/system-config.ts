import { query } from './pool.js';

export interface SystemConfigValues {
  privateRoomEnabled: boolean;
  privateRoomGlobalPause: boolean;
  officialRakeRate: number;
  privateRakeRate: number;
  botDailyBudget: number;
  newbieProtectionEnabled: boolean;
  firstRechargeBonusEnabled: boolean;
  firstRechargeBonusPct: number;
  dailyRechargeLimit: number;
  leaderboardRefreshMinutes: number;
  betaMigrationActive: boolean;
  betaMigrationMessage: Record<string, string>;
}

const CONFIG_KEYS = [
  'private_room_enabled',
  'private_room_global_pause',
  'official_rake_rate',
  'private_rake_rate',
  'bot_daily_budget',
  'newbie_protection_enabled',
  'first_recharge_bonus_enabled',
  'first_recharge_bonus_pct',
  'daily_recharge_limit',
  'leaderboard_refresh_minutes',
  'beta_migration_active',
  'beta_migration_message',
] as const;

const DEFAULTS: SystemConfigValues = {
  privateRoomEnabled: true,
  privateRoomGlobalPause: false,
  officialRakeRate: 0.05,
  privateRakeRate: 0.03,
  botDailyBudget: 500_000,
  newbieProtectionEnabled: false,
  firstRechargeBonusEnabled: true,
  firstRechargeBonusPct: 50,
  dailyRechargeLimit: 50_000,
  leaderboardRefreshMinutes: 10,
  betaMigrationActive: false,
  betaMigrationMessage: {
    'zh-CN': '公测即将开始，内测筹码将清零并重新赠送100筹码。',
    'en-US': 'Open beta starts soon. Beta chips will reset; new players receive 100 chips.',
  },
};

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return fallback;
}

function parseNum(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function getConfigMap(): Promise<Map<string, unknown>> {
  const res = await query<{ config_key: string; config_value: unknown }>(
    `SELECT config_key, config_value FROM system_config WHERE config_key = ANY($1)`,
    [CONFIG_KEYS],
  );
  return new Map(res.rows.map((r) => [r.config_key, r.config_value]));
}

export async function getConfigValue(key: string): Promise<unknown> {
  const res = await query<{ config_value: unknown }>(
    `SELECT config_value FROM system_config WHERE config_key = $1`,
    [key],
  );
  return res.rows[0]?.config_value;
}

async function upsertConfig(key: string, value: unknown): Promise<void> {
  await query(
    `INSERT INTO system_config (config_key, config_value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()`,
    [key, JSON.stringify(value)],
  );
}

export async function getSystemConfig(): Promise<SystemConfigValues> {
  const map = await getConfigMap();
  const msg = map.get('beta_migration_message');
  return {
    privateRoomEnabled: parseBool(map.get('private_room_enabled'), DEFAULTS.privateRoomEnabled),
    privateRoomGlobalPause: parseBool(
      map.get('private_room_global_pause'),
      DEFAULTS.privateRoomGlobalPause,
    ),
    officialRakeRate: parseNum(map.get('official_rake_rate'), DEFAULTS.officialRakeRate),
    privateRakeRate: parseNum(map.get('private_rake_rate'), DEFAULTS.privateRakeRate),
    botDailyBudget: parseNum(map.get('bot_daily_budget'), DEFAULTS.botDailyBudget),
    newbieProtectionEnabled: parseBool(
      map.get('newbie_protection_enabled'),
      DEFAULTS.newbieProtectionEnabled,
    ),
    firstRechargeBonusEnabled: parseBool(
      map.get('first_recharge_bonus_enabled'),
      DEFAULTS.firstRechargeBonusEnabled,
    ),
    firstRechargeBonusPct: parseNum(map.get('first_recharge_bonus_pct'), DEFAULTS.firstRechargeBonusPct),
    dailyRechargeLimit: parseNum(map.get('daily_recharge_limit'), DEFAULTS.dailyRechargeLimit),
    leaderboardRefreshMinutes: parseNum(
      map.get('leaderboard_refresh_minutes'),
      DEFAULTS.leaderboardRefreshMinutes,
    ),
    betaMigrationActive: parseBool(map.get('beta_migration_active'), DEFAULTS.betaMigrationActive),
    betaMigrationMessage:
      msg && typeof msg === 'object' && !Array.isArray(msg)
        ? (msg as Record<string, string>)
        : DEFAULTS.betaMigrationMessage,
  };
}

export async function updateSystemConfig(
  patch: Partial<SystemConfigValues>,
): Promise<SystemConfigValues> {
  if (patch.privateRoomEnabled !== undefined) {
    await upsertConfig('private_room_enabled', patch.privateRoomEnabled);
  }
  if (patch.privateRoomGlobalPause !== undefined) {
    await upsertConfig('private_room_global_pause', patch.privateRoomGlobalPause);
  }
  if (patch.officialRakeRate !== undefined) {
    await upsertConfig('official_rake_rate', patch.officialRakeRate);
  }
  if (patch.privateRakeRate !== undefined) {
    await upsertConfig('private_rake_rate', patch.privateRakeRate);
  }
  if (patch.botDailyBudget !== undefined) {
    await upsertConfig('bot_daily_budget', patch.botDailyBudget);
  }
  if (patch.newbieProtectionEnabled !== undefined) {
    await upsertConfig('newbie_protection_enabled', patch.newbieProtectionEnabled);
  }
  if (patch.firstRechargeBonusEnabled !== undefined) {
    await upsertConfig('first_recharge_bonus_enabled', patch.firstRechargeBonusEnabled);
  }
  if (patch.firstRechargeBonusPct !== undefined) {
    await upsertConfig('first_recharge_bonus_pct', patch.firstRechargeBonusPct);
  }
  if (patch.dailyRechargeLimit !== undefined) {
    await upsertConfig('daily_recharge_limit', patch.dailyRechargeLimit);
  }
  if (patch.leaderboardRefreshMinutes !== undefined) {
    await upsertConfig('leaderboard_refresh_minutes', patch.leaderboardRefreshMinutes);
  }
  if (patch.betaMigrationActive !== undefined) {
    await upsertConfig('beta_migration_active', patch.betaMigrationActive);
  }
  if (patch.betaMigrationMessage !== undefined) {
    await upsertConfig('beta_migration_message', patch.betaMigrationMessage);
  }
  return getSystemConfig();
}

export async function isPrivateRoomAllowed(): Promise<boolean> {
  const cfg = await getSystemConfig();
  return cfg.privateRoomEnabled && !cfg.privateRoomGlobalPause;
}

export async function getRakeRate(roomType: 'OFFICIAL' | 'PRIVATE'): Promise<number> {
  const cfg = await getSystemConfig();
  return roomType === 'PRIVATE' ? cfg.privateRakeRate : cfg.officialRakeRate;
}
