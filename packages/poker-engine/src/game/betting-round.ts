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

export function isBettingRoundComplete(
  players: PlayerState[],
  currentBet: number,
  roundState?: BettingRoundState,
): boolean {
  const canAct = players.filter((p) => p.status === 'ACTIVE');
  if (canAct.length <= 1) return true;

  for (const p of canAct) {
    if (p.betThisRound !== currentBet) return false;
    if (roundState && !roundState.actedSeats.has(p.seatIndex)) return false;
  }
  return true;
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
