/** Retired LXC address — login fails with ERR_ADDRESS_UNREACHABLE if still used. */
const RETIRED_LAN_HOST = '192.168.31.53';
const STAGING_LAN_HOST = '192.168.31.4';

function resolveLanUrl(raw: string | undefined, fallback: string): string {
  const value = raw && raw.trim().length > 0 ? raw.trim() : fallback;
  return value.split(RETIRED_LAN_HOST).join(STAGING_LAN_HOST);
}

export const API_URL = resolveLanUrl(
  process.env.EXPO_PUBLIC_API_URL,
  `http://${STAGING_LAN_HOST}:3000`,
);

export const ROOM_URL = resolveLanUrl(
  process.env.EXPO_PUBLIC_ROOM_URL,
  `http://${STAGING_LAN_HOST}:3001`,
);

if (__DEV__) {
  console.log(`[mobile] lan api=${API_URL} room=${ROOM_URL}`);
}
