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

export interface SeatAction {
  type: string;
  amount?: number;
}

export interface HandWinner {
  seatIndex: number;
  userId: string;
  nickname: string;
  winAmount: number;
}

export interface SettlementRefund {
  seatIndex: number;
  userId: string;
  nickname: string;
  amount: number;
}

export interface SettlementPotWinner {
  seatIndex: number;
  userId: string;
  nickname: string;
  amount: number;
}

export interface SettlementPot {
  kind: 'main' | 'side';
  sideIndex?: number;
  amount: number;
  winners: SettlementPotWinner[];
}

export interface HandEndPayload {
  handId: string;
  nextHandIn: number;
  potSize: number;
  boardCards: string;
  winners: HandWinner[];
  refunds?: SettlementRefund[];
  pots?: SettlementPot[];
}
