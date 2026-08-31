/** Official and private cash tables are 6-max only. */
export const MAX_TABLE_SEATS = 6;

export const MIN_TABLE_SEATS = 2;

/** Official cash: keep 1/2 so a 100-chip buy-in stays 50 BB. */
export const OFFICIAL_SMALL_BLIND = 1;
export const OFFICIAL_BIG_BLIND = 2;
export const OFFICIAL_MIN_BUY_IN = 40;
export const OFFICIAL_MAX_BUY_IN = 100;

/** Spec V1.0 timers, applied to 6-max. */
export const ACTION_TIME_SEC = 20;
export const TIME_BANK_SEC = 60;
export const ACTION_TIME_MS = ACTION_TIME_SEC * 1000;
export const TIME_BANK_MS = TIME_BANK_SEC * 1000;

export const HAND_PAUSE_MS = 3000;

/** Public lobby pool: keep at least 9 tables; add one after each 6 real users. */
export const MIN_PUBLIC_TABLES = 9;
export const MIN_PUBLIC_TABLE_BOTS = 3;
export const PUBLIC_TABLE_ID_PREFIX = 'PUB-';

export function publicTableId(index: number): string {
  return `${PUBLIC_TABLE_ID_PREFIX}${index}`;
}

export function isPublicTableId(roomId: string): boolean {
  return roomId.startsWith(PUBLIC_TABLE_ID_PREFIX);
}

/** 0–6 real users → 9 tables; 7–12 → 10; 13–18 → 11. */
export function targetPublicTableCount(realUsers: number): number {
  const n = Math.max(0, Math.floor(realUsers));
  if (n <= 0) return MIN_PUBLIC_TABLES;
  return Math.max(MIN_PUBLIC_TABLES, MIN_PUBLIC_TABLES + Math.floor((n - 1) / MAX_TABLE_SEATS));
}
