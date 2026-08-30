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
