export type RoomType = 'OFFICIAL' | 'PRIVATE';

export type SupportedLocale = 'zh-CN' | 'en-US';

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh-CN', 'en-US'];

import colors from './design-tokens/colors.json' with { type: 'json' };

export const designTokens = colors;

export type PlayerActionType = 'fold' | 'check' | 'call' | 'raise' | 'all_in';

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
