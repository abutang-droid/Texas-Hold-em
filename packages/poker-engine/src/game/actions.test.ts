import { describe, it, expect } from 'vitest';
import { applyAction, getValidActions, isBettingRoundComplete } from '../game/actions.js';
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

describe('actions', () => {
  it('lists valid actions facing bet', () => {
    const players = [
      player({ seatIndex: 0, betThisRound: 0, chips: 100 }),
      player({ seatIndex: 1, betThisRound: 10, chips: 90 }),
    ];
    const valid = getValidActions({
      players,
      currentSeat: 0,
      bigBlind: 2,
      currentBet: 10,
      minRaise: 10,
    });
    expect(valid.actions).toContain('fold');
    expect(valid.actions).toContain('call');
    expect(valid.callAmount).toBe(10);
  });

  it('always allows fold on your turn, including when you can check', () => {
    const players = [
      player({ seatIndex: 0, betThisRound: 0, chips: 100 }),
      player({ seatIndex: 1, betThisRound: 0, chips: 100 }),
    ];
    const valid = getValidActions({
      players,
      currentSeat: 0,
      bigBlind: 2,
      currentBet: 0,
      minRaise: 2,
    });
    expect(valid.actions).toContain('fold');
    expect(valid.actions).toContain('check');
  });

  it('applies raise and updates current bet', () => {
    const p = player({ seatIndex: 0, chips: 100 });
    const result = applyAction({
      player: p,
      action: 'raise',
      amount: 20,
      currentBet: 10,
      minRaise: 10,
    });
    expect(result.player.chips).toBe(80);
    expect(result.player.betThisRound).toBe(20);
    expect(result.newCurrentBet).toBe(20);
  });

  it('detects betting round complete', () => {
    const players = [
      player({ seatIndex: 0, betThisRound: 10 }),
      player({ seatIndex: 1, betThisRound: 10 }),
    ];
    expect(isBettingRoundComplete(players, 10)).toBe(true);
  });
});
