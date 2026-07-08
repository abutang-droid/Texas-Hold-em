import { query } from './pool.js';

export interface SystemConfigValues {
  privateRoomEnabled: boolean;
  privateRoomGlobalPause: boolean;
}

const DEFAULTS: SystemConfigValues = {
  privateRoomEnabled: true,
  privateRoomGlobalPause: false,
};

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return fallback;
}

export async function getSystemConfig(): Promise<SystemConfigValues> {
  const res = await query<{ config_key: string; config_value: unknown }>(
    `SELECT config_key, config_value FROM system_config
     WHERE config_key IN ('private_room_enabled', 'private_room_global_pause')`,
  );
  const map = new Map(res.rows.map((r) => [r.config_key, r.config_value]));
  return {
    privateRoomEnabled: parseBool(map.get('private_room_enabled'), DEFAULTS.privateRoomEnabled),
    privateRoomGlobalPause: parseBool(
      map.get('private_room_global_pause'),
      DEFAULTS.privateRoomGlobalPause,
    ),
  };
}

export async function updateSystemConfig(
  patch: Partial<SystemConfigValues>,
): Promise<SystemConfigValues> {
  if (patch.privateRoomEnabled !== undefined) {
    await query(
      `INSERT INTO system_config (config_key, config_value, updated_at)
       VALUES ('private_room_enabled', $1::jsonb, NOW())
       ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()`,
      [JSON.stringify(patch.privateRoomEnabled)],
    );
  }
  if (patch.privateRoomGlobalPause !== undefined) {
    await query(
      `INSERT INTO system_config (config_key, config_value, updated_at)
       VALUES ('private_room_global_pause', $1::jsonb, NOW())
       ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = NOW()`,
      [JSON.stringify(patch.privateRoomGlobalPause)],
    );
  }
  return getSystemConfig();
}

export async function isPrivateRoomAllowed(): Promise<boolean> {
  const cfg = await getSystemConfig();
  return cfg.privateRoomEnabled && !cfg.privateRoomGlobalPause;
}
