import type { PlayerState } from './settlement.js';
export type { BettingRoundState, RaiseClass } from './betting-round.js';
export {
  createBettingRoundState,
  markBlindPosted,
  recordPlayerAction,
  resetBettingRound,
  actionWasRaise,
  isBettingRoundComplete,
  playerNeedsAction,
  nextSeatNeedingAction,
  classifyRaise,
  countActionablePlayers,
  countPlayersInHand,
  shouldRunoutBoard,
} from './betting-round.js';

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';

export interface ActionContext {
  players: PlayerState[];
  currentSeat: number;
  bigBlind: number;
  currentBet: number;
  minRaise: number;
  raiseClosed?: boolean;
}

export interface ValidActions {
  actions: ActionType[];
  callAmount: number;
  minRaiseTotal: number;
  maxRaiseTotal: number;
}

export function getValidActions(ctx: ActionContext): ValidActions {
  const player = ctx.players.find((p) => p.seatIndex === ctx.currentSeat);
  if (!player || player.status !== 'ACTIVE') {
    return { actions: [], callAmount: 0, minRaiseTotal: 0, maxRaiseTotal: 0 };
  }

  const toCall = ctx.currentBet - player.betThisRound;
  const actions: ActionType[] = [];
  const canCheck = toCall <= 0;
  const remaining = player.chips;
  const noBetYet = ctx.currentBet <= 0;
  const canOpen = !ctx.raiseClosed && remaining > toCall;

  if (!canCheck) actions.push('fold');
  if (canCheck) actions.push('check');
  if (toCall > 0 && remaining >= toCall) actions.push('call');
  if (canOpen) {
    if (noBetYet) {
      actions.push('bet');
      actions.push('raise');
    } else {
      actions.push('raise');
    }
    actions.push('all_in');
  } else if (remaining > 0 && toCall > 0) {
    actions.push('all_in');
  }

  const minRaiseTotal = noBetYet
    ? player.betThisRound + Math.max(ctx.bigBlind, ctx.minRaise)
    : ctx.currentBet + ctx.minRaise;
  const maxRaiseTotal = player.betThisRound + remaining;

  return {
    actions,
    callAmount: Math.min(Math.max(toCall, 0), remaining),
    minRaiseTotal: Math.min(minRaiseTotal, maxRaiseTotal),
    maxRaiseTotal,
  };
}

export interface ApplyActionInput {
  player: PlayerState;
  action: ActionType;
  amount?: number;
  currentBet: number;
  minRaise: number;
  raiseClosed?: boolean;
}

export interface ApplyActionResult {
  player: PlayerState;
  newCurrentBet: number;
  raiseSize: number;
  raiseClass: import('./betting-round.js').RaiseClass;
}

export function applyAction(input: ApplyActionInput): ApplyActionResult {
  const { player, action, currentBet, minRaise } = input;
  const updated = { ...player, holeCards: [...player.holeCards] };
  const toCall = currentBet - updated.betThisRound;
  let newCurrentBet = currentBet;
  let raiseSize = 0;

  switch (action) {
    case 'fold':
      updated.status = 'FOLDED';
      break;
    case 'check':
      if (toCall > 0) throw new Error('Cannot check when facing a bet');
      break;
    case 'call': {
      if (toCall <= 0) break;
      const pay = Math.min(toCall, updated.chips);
      if (pay <= 0) break;
      updated.chips -= pay;
      updated.betThisRound += pay;
      updated.totalBetInHand += pay;
      if (updated.chips === 0) updated.status = 'ALL_IN';
      break;
    }
    case 'bet':
    case 'raise':
    case 'all_in': {
      if (input.raiseClosed && (action === 'bet' || action === 'raise')) {
        throw new Error('Raise not reopened after a short all-in');
      }
      const targetTotal = action === 'all_in'
        ? updated.betThisRound + updated.chips
        : (input.amount ?? (currentBet > 0 ? currentBet + minRaise : updated.betThisRound + minRaise));
      if (targetTotal < updated.betThisRound) {
        throw new Error('Invalid raise amount');
      }
      const add = Math.min(targetTotal - updated.betThisRound, updated.chips);
      const projected = updated.betThisRound + add;
      const opening = currentBet <= 0;
      if (
        (action === 'raise' || action === 'bet') &&
        !opening &&
        projected < currentBet + minRaise &&
        add < updated.chips
      ) {
        throw new Error(`Raise must be at least ${currentBet + minRaise}`);
      }
      if ((action === 'raise' || action === 'bet') && opening && projected < minRaise && add < updated.chips) {
        throw new Error(`Bet must be at least ${minRaise}`);
      }
      updated.chips -= add;
      updated.betThisRound += add;
      updated.totalBetInHand += add;
      raiseSize = updated.betThisRound - currentBet;
      newCurrentBet = Math.max(newCurrentBet, updated.betThisRound);
      if (updated.chips === 0) updated.status = 'ALL_IN';
      break;
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }

  let raiseClass: import('./betting-round.js').RaiseClass = 'no_raise';
  if (raiseSize > 0) {
    if (raiseSize >= minRaise) raiseClass = 'full_raise';
    else if (updated.status === 'ALL_IN') raiseClass = 'short_all_in';
  }

  return { player: updated, newCurrentBet, raiseSize, raiseClass };
}

export function countActivePlayers(players: PlayerState[]): number {
  return players.filter((p) => p.status === 'ACTIVE' || p.status === 'ALL_IN').length;
}

export function nextActiveSeat(players: PlayerState[], fromSeat: number): number | null {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  if (sorted.length === 0) return null;
  const n = sorted.length;
  const start = sorted.findIndex((p) => p.seatIndex === fromSeat);
  const startIdx = start >= 0 ? start : 0;
  for (let i = 1; i <= n; i += 1) {
    const p = sorted[(startIdx + i) % n];
    if (p.status === 'ACTIVE') return p.seatIndex;
  }
  return null;
}

/** Next seat index with chips (for dealer button rotation). */
export function nextSeatWithChips(
  seatIndices: number[],
  fromSeat: number,
  hasChips: (seat: number) => boolean,
): number | null {
  if (seatIndices.length === 0) return null;
  const sorted = [...seatIndices].sort((a, b) => a - b);
  const start = sorted.indexOf(fromSeat);
  const startIdx = start >= 0 ? start : 0;
  for (let i = 1; i <= sorted.length; i += 1) {
    const seat = sorted[(startIdx + i) % sorted.length]!;
    if (hasChips(seat)) return seat;
  }
  return sorted[startIdx] ?? null;
}
