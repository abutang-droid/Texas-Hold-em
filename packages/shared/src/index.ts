export type RoomType = 'OFFICIAL' | 'PRIVATE';

export type SupportedLocale = 'zh-CN' | 'en-US';

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh-CN', 'en-US'];

import colors from './design-tokens/colors.json' with { type: 'json' };

export const designTokens = colors;

export {
  AVATAR_PRESETS,
  presetAvatarUrl,
  parseAvatarPreset,
  isValidPresetAvatarUrl,
} from './avatars.js';
export type { AvatarPreset } from './avatars.js';

export {
  TABLE_EMOJI_PRESETS,
  getTableEmoji,
  isValidTableEmojiId,
} from './table-emojis.js';
export type { TableEmojiPreset } from './table-emojis.js';

export {
  MAX_TABLE_SEATS,
  MIN_TABLE_SEATS,
  OFFICIAL_SMALL_BLIND,
  OFFICIAL_BIG_BLIND,
  OFFICIAL_MIN_BUY_IN,
  OFFICIAL_MAX_BUY_IN,
  ACTION_TIME_SEC,
  TIME_BANK_SEC,
  ACTION_TIME_MS,
  TIME_BANK_MS,
  HAND_PAUSE_MS,
  MIN_PUBLIC_TABLES,
  MIN_PUBLIC_TABLE_BOTS,
  PUBLIC_TABLE_ID_PREFIX,
  publicTableId,
  isPublicTableId,
  targetPublicTableCount,
} from './table-config.js';

export type PlayerActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';

export type GamePhase =
  | 'WAITING'
  | 'PRE_FLOP'
  | 'FLOP'
  | 'TURN'
  | 'RIVER'
  | 'SHOWDOWN'
  | 'END_HAND';

export type SeatStatus = 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'SIT_OUT';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  requestId?: string;
}
