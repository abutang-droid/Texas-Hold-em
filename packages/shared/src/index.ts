export type RoomType = 'OFFICIAL' | 'PRIVATE';

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
