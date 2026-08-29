import { describe, it, expect } from 'vitest';
import {
  createBettingRoundState,
  markBlindPosted,
  recordPlayerAction,
  isBettingRoundComplete,
} from '../game/betting-round.js';
import type { PlayerState } from '../game/settlement.js';

function player(overrides: Partial<PlayerState> & { seatIndex: number }): PlayerState {
  return {
    seatIndex: overrides.seatIndex,
    userId: `u${overrides.seatIndex}`,
    nickname: `P${overrides.seatIndex}`,
    chips: 100,
    betThisRound: 0,
    totalBetInHand: 0,
    status: 'ACTIVE',
    holeCards: [],
    isBot: false,
    ...overrides,
  };
}

describe('betting round', () => {
  it('gives BB option when everyone limps preflop', () => {
    const state = createBettingRoundState({ bbSeat: 2 });
    markBlindPosted(state, 0); // SB

    const players = [
      player({ seatIndex: 0, betThisRound: 2 }),
      player({ seatIndex: 1, betThisRound: 2 }),
      player({ seatIndex: 2, betThisRound: 2 }),
    ];

    recordPlayerAction(state, 0, false); // SB completes
    recordPlayerAction(state, 1, false); // UTG limps

    expect(isBettingRoundComplete(players, 2, state)).toBe(false);

    recordPlayerAction(state, 2, false); // BB checks

    expect(isBettingRoundComplete(players, 2, state)).toBe(true);
  });

  it('resets acted seats after a raise', () => {
    const state = createBettingRoundState({ bbSeat: 2 });
    const players = [
      player({ seatIndex: 0, betThisRound: 10 }),
      player({ seatIndex: 1, betThisRound: 2 }),
      player({ seatIndex: 2, betThisRound: 10 }),
    ];

    recordPlayerAction(state, 0, true); // raise

    expect(state.actedSeats.has(0)).toBe(true);
    expect(state.actedSeats.has(1)).toBe(false);
    expect(isBettingRoundComplete(players, 10, state)).toBe(false);
  });
});
