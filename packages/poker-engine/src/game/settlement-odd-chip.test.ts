import { describe, it, expect } from 'vitest';
import { distributePotToWinners } from './settlement.js';
import { seatsClockwiseFromLeftOfButton } from './blinds.js';
import type { PlayerState } from './settlement.js';
import type { Card } from '../cards/card.js';
import { evaluateBestHand } from '../eval/hand-evaluator.js';

function player(seat: number, hole: Card[]): PlayerState {
  return {
    seatIndex: seat,
    userId: `u${seat}`,
    nickname: `P${seat}`,
    chips: 0,
    betThisRound: 0,
    totalBetInHand: 50,
    status: 'ACTIVE',
    holeCards: hole,
    isBot: false,
  };
}

describe('odd chip', () => {
  it('gives remainder to first winner left of the button', () => {
    const board: Card[] = [
      { rank: 'A', suit: 's' },
      { rank: 'K', suit: 's' },
      { rank: 'Q', suit: 's' },
      { rank: 'J', suit: 's' },
      { rank: 'T', suit: 'h' },
    ];
    const players = [
      player(0, [{ rank: '2', suit: 'c' }, { rank: '3', suit: 'd' }]),
      player(1, [{ rank: '4', suit: 'c' }, { rank: '5', suit: 'd' }]),
    ];
    const order = seatsClockwiseFromLeftOfButton(0, [0, 1]);
    const result = distributePotToWinners(
      [{ amount: 101, eligibleSeatIndices: [0, 1] }],
      players,
      board,
      evaluateBestHand,
      true,
      0,
      order,
    );
    const bySeat = Object.fromEntries(result.winners.map((w) => [w.seatIndex, w.winAmount]));
    expect(bySeat[1] + bySeat[0]).toBe(101);
    expect(bySeat[1]).toBe(51);
    expect(bySeat[0]).toBe(50);
  });
});
