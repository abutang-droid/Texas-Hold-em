import type { PlayerState } from './settlement.js';
import type { ActionType } from './actions.js';

/** Tracks who has acted since the last *full* raise (and BB option preflop). */
export interface BettingRoundState {
  actedSeats: Set<number>;
  raiseClosedSeats: Set<number>;
  bbSeat: number | null;
  lastFullRaise: number;
}

export function createBettingRoundState(opts?: {
  bbSeat?: number;
  minRaise?: number;
}): BettingRoundState {
  return {
    actedSeats: new Set(),
    raiseClosedSeats: new Set(),
    bbSeat: opts?.bbSeat ?? null,
    lastFullRaise: opts?.minRaise ?? 0,
  };
}

/** Blinds: SB counts as acted; BB keeps option until they act. */
export function markBlindPosted(state: BettingRoundState, seatIndex: number): void {
  if (seatIndex !== state.bbSeat) {
    state.actedSeats.add(seatIndex);
  }
}

export type RaiseClass = 'full_raise' | 'short_all_in' | 'no_raise';

export function classifyRaise(raiseSize: number, minRaise: number, wentAllIn: boolean): RaiseClass {
  if (raiseSize <= 0) return 'no_raise';
  if (raiseSize >= minRaise) return 'full_raise';
  if (wentAllIn) return 'short_all_in';
  return 'no_raise';
}

export function recordPlayerAction(
  state: BettingRoundState,
  seatIndex: number,
  raiseClass: RaiseClass | boolean,
): void {
  const kind: RaiseClass =
    typeof raiseClass === 'boolean' ? (raiseClass ? 'full_raise' : 'no_raise') : raiseClass;

  if (kind === 'full_raise') {
    state.actedSeats.clear();
    state.raiseClosedSeats.clear();
    state.actedSeats.add(seatIndex);
    return;
  }

  if (kind === 'short_all_in') {
    for (const s of state.actedSeats) {
      state.raiseClosedSeats.add(s);
    }
    state.actedSeats.add(seatIndex);
    return;
  }

  state.actedSeats.add(seatIndex);
}

export function resetBettingRound(state: BettingRoundState, minRaise = 0): void {
  state.actedSeats.clear();
  state.raiseClosedSeats.clear();
  state.bbSeat = null;
  state.lastFullRaise = minRaise;
}

/** True if this active player still owes an action this street. */
export function playerNeedsAction(
  player: PlayerState,
  currentBet: number,
  roundState?: BettingRoundState,
): boolean {
  if (player.status !== 'ACTIVE') return false;
  if (player.betThisRound !== currentBet) return true;
  if (roundState && !roundState.actedSeats.has(player.seatIndex)) return true;
  return false;
}

export function isBettingRoundComplete(
  players: PlayerState[],
  currentBet: number,
  roundState?: BettingRoundState,
): boolean {
  const canAct = players.filter((p) => p.status === 'ACTIVE');
  if (canAct.length <= 1) return true;
  return !canAct.some((p) => playerNeedsAction(p, currentBet, roundState));
}

/**
 * Next clockwise seat that still needs to act.
 * Unlike nextActiveSeat, skips players who already matched and acted
 * so a call cannot hand the turn back to the caller.
 */
export function nextSeatNeedingAction(
  players: PlayerState[],
  fromSeat: number,
  currentBet: number,
  roundState?: BettingRoundState,
): number | null {
  const sorted = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  if (sorted.length === 0) return null;
  const start = sorted.findIndex((p) => p.seatIndex === fromSeat);
  const startIdx = start >= 0 ? start : 0;
  for (let i = 1; i <= sorted.length; i += 1) {
    const p = sorted[(startIdx + i) % sorted.length];
    if (playerNeedsAction(p, currentBet, roundState)) return p.seatIndex;
  }
  return null;
}

/** Remaining players who can still put chips in. */
export function countActionablePlayers(players: PlayerState[]): number {
  return players.filter((p) => p.status === 'ACTIVE').length;
}

/** Unfolded players still in the hand (active or all-in). */
export function countPlayersInHand(players: PlayerState[]): number {
  return players.filter((p) => p.status !== 'FOLDED' && p.status !== 'SIT_OUT').length;
}

export function shouldRunoutBoard(players: PlayerState[]): boolean {
  return countPlayersInHand(players) >= 2 && countActionablePlayers(players) <= 1;
}

export function actionWasRaise(action: ActionType, raiseSize: number): boolean {
  return raiseSize > 0 || action === 'raise' || action === 'bet' || action === 'all_in';
}
