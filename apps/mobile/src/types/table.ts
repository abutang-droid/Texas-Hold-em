export type PokerAction = 'fold' | 'check' | 'call' | 'raise' | 'all_in';

export interface TurnContext {
  seatIndex: number;
  deadline: number;
  validActions: PokerAction[];
  callAmount: number;
  minRaise: number;
  maxRaise: number;
}

export interface TableMeta {
  phase: string;
  handId: string | null;
  blinds: { sb: number; bb: number };
  actionDeadline: number | null;
}

export interface LastAction {
  nickname: string;
  actionType: string;
  amount?: number;
  autoAction?: boolean;
}

export interface HandEndNotice {
  handId: string;
  nextHandIn: number;
  shownAt: number;
}
