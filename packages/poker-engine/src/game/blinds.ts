import type { PlayerState } from './settlement.js';
import { nextActiveSeat } from './actions.js';

export interface BlindSeats {
  sbSeat: number;
  bbSeat: number;
}

/**
 * 6-max / cash:
 * - 3+ players: SB = left of button, BB = left of SB
 * - Heads-up: Button posts SB; the other player posts BB
 */
export function assignBlindSeats(buttonSeat: number, activeSeats: number[]): BlindSeats {
  const seats = [...new Set(activeSeats)].sort((a, b) => a - b);
  if (seats.length < 2) {
    throw new Error('Need at least 2 players to post blinds');
  }

  if (seats.length === 2) {
    const button = seats.includes(buttonSeat) ? buttonSeat : seats[0];
    const other = seats.find((s) => s !== button) ?? seats[1];
    return { sbSeat: button, bbSeat: other };
  }

  const btnIdx = seats.indexOf(buttonSeat);
  const start = btnIdx >= 0 ? btnIdx : 0;
  return {
    sbSeat: seats[(start + 1) % seats.length],
    bbSeat: seats[(start + 2) % seats.length],
  };
}

export type BettingStreet = 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER';

/**
 * First actionable seat:
 * - Preflop HU: Button/SB
 * - Preflop 3–6: UTG (left of BB)
 * - Postflop HU: BB
 * - Postflop 3–6: left of button (usually SB)
 */
export function firstToActSeat(
  street: BettingStreet,
  buttonSeat: number,
  bbSeat: number,
  players: PlayerState[],
): number | null {
  const inHand = players.filter((p) => p.status !== 'SIT_OUT' && p.status !== 'FOLDED');
  const headsUp = inHand.length === 2;

  if (street === 'PRE_FLOP') {
    return nextActiveSeat(players, bbSeat);
  }

  if (headsUp) {
    const bb = players.find((p) => p.seatIndex === bbSeat);
    if (bb && bb.status === 'ACTIVE') return bbSeat;
    return nextActiveSeat(players, bbSeat);
  }

  return nextActiveSeat(players, buttonSeat);
}

/** Clockwise seats starting strictly left of the button (odd-chip order). */
export function seatsClockwiseFromLeftOfButton(buttonSeat: number, seats: number[]): number[] {
  const sorted = [...new Set(seats)].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const after = sorted.findIndex((s) => s > buttonSeat);
  const start = after >= 0 ? after : 0;
  const out: number[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    out.push(sorted[(start + i) % sorted.length]);
  }
  return out;
}

/** Clockwise active seats starting left of button — hole cards dealt 1 + 1. */
export function dealOrderFromButton(buttonSeat: number, activeSeats: number[]): number[] {
  return seatsClockwiseFromLeftOfButton(buttonSeat, activeSeats);
}
