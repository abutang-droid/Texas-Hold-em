import type { PlayerState } from './settlement.js';
import type { ActionType } from './actions.js';

/** Tracks who has acted since the last raise (and BB option preflop). */
export interface BettingRoundState {
  actedSeats: Set<number>;
  bbSeat: number | null;
}

export function createBettingRoundState(opts?: { bbSeat?: number }): BettingRoundState {
  return {
    actedSeats: new Set(),
    bbSeat: opts?.bbSeat ?? null,
  };
}

/** Blinds: SB counts as acted; BB keeps option until they act. */
export function markBlindPosted(state: BettingRoundState, seatIndex: number): void {
  if (seatIndex !== state.bbSeat) {
    state.actedSeats.add(seatIndex);
  }
}

export function recordPlayerAction(
  state: BettingRoundState,
  seatIndex: number,
  wasRaise: boolean,
): void {
  if (wasRaise) {
    state.actedSeats.clear();
    state.actedSeats.add(seatIndex);
    return;
  }
  state.actedSeats.add(seatIndex);
}

export function resetBettingRound(state: BettingRoundState): void {
  state.actedSeats.clear();
  state.bbSeat = null;
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

export function actionWasRaise(action: ActionType, raiseSize: number): boolean {
  return raiseSize > 0 || action === 'raise' || action === 'all_in';
}
