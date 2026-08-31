import { describe, it, expect } from 'vitest';
import {
  applyAction,
  classifyRaise,
  createBettingRoundState,
  getValidActions,
  recordPlayerAction,
} from './actions.js';
import type { PlayerState } from './settlement.js';

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

describe('short all-in raise', () => {
  it('classifies incomplete all-in as short_all_in', () => {
    expect(classifyRaise(50, 100, true)).toBe('short_all_in');
    expect(classifyRaise(100, 100, true)).toBe('full_raise');
    expect(classifyRaise(0, 100, true)).toBe('no_raise');
  });

  it('does not reopen raise for players who already acted', () => {
    const state = createBettingRoundState({ minRaise: 100 });
    recordPlayerAction(state, 0, 'full_raise');
    recordPlayerAction(state, 1, 'no_raise');
    recordPlayerAction(state, 2, 'short_all_in');

    expect(state.raiseClosedSeats.has(0)).toBe(true);
    expect(state.raiseClosedSeats.has(1)).toBe(true);
    expect(state.actedSeats.has(2)).toBe(true);

    const players = [
      player({ seatIndex: 0, betThisRound: 100, chips: 200 }),
      player({ seatIndex: 1, betThisRound: 100, chips: 200 }),
      player({ seatIndex: 2, betThisRound: 150, chips: 0, status: 'ALL_IN' }),
    ];
    const valid = getValidActions({
      players,
      currentSeat: 0,
      bigBlind: 20,
      currentBet: 150,
      minRaise: 100,
      raiseClosed: state.raiseClosedSeats.has(0),
    });
    expect(valid.actions).toContain('call');
    expect(valid.actions).toContain('fold');
    expect(valid.actions).not.toContain('raise');
  });

  it('applyAction rejects a reopened raise', () => {
    const p = player({ seatIndex: 0, betThisRound: 100, chips: 200 });
    expect(() =>
      applyAction({
        player: p,
        action: 'raise',
        amount: 300,
        currentBet: 150,
        minRaise: 100,
        raiseClosed: true,
      }),
    ).toThrow(/not reopened/);
  });
});
