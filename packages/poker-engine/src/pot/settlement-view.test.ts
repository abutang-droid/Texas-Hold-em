import { describe, it, expect } from 'vitest';
import { calculateSidePots } from './side-pot.js';
import {
  buildContestedSettlementView,
  buildUncontestedSettlementView,
  settlementPauseMs,
  uncalledExcess,
} from './settlement-view.js';

describe('settlement-view', () => {
  it('detects uncalled excess', () => {
    expect(
      uncalledExcess([
        { seatIndex: 0, totalBet: 100 },
        { seatIndex: 1, totalBet: 300 },
        { seatIndex: 2, totalBet: 500 },
      ]),
    ).toEqual({ seatIndex: 2, amount: 200 });
  });

  it('splits uncalled return from main pot when others fold', () => {
    const view = buildUncontestedSettlementView({
      winnerSeat: 1,
      distributablePot: 53,
      playerBets: [
        { seatIndex: 0, totalBet: 1 },
        { seatIndex: 1, totalBet: 52 },
      ],
    });
    expect(view.refunds).toEqual([{ seatIndex: 1, amount: 51 }]);
    expect(view.pots).toEqual([
      { kind: 'main', amount: 2, winners: [{ seatIndex: 1, amount: 2 }] },
    ]);
  });

  it('labels main and side pots and peels the uncalled layer', () => {
    const pots = calculateSidePots([
      { seatIndex: 0, totalBet: 100, isFolded: false, isAllIn: true },
      { seatIndex: 1, totalBet: 300, isFolded: false, isAllIn: true },
      { seatIndex: 2, totalBet: 500, isFolded: false, isAllIn: true },
    ]);
    const breakdown = pots.map((p, potIndex) => ({
      potIndex,
      amount: p.amount,
      winners: p.eligibleSeatIndices.map((seatIndex) => ({
        seatIndex,
        amount: Math.floor(p.amount / p.eligibleSeatIndices.length),
      })),
    }));
    const view = buildContestedSettlementView({
      pots,
      breakdown,
      playerBets: [
        { seatIndex: 0, totalBet: 100 },
        { seatIndex: 1, totalBet: 300 },
        { seatIndex: 2, totalBet: 500 },
      ],
    });
    expect(view.refunds).toEqual([{ seatIndex: 2, amount: 200 }]);
    expect(view.pots.map((p) => p.kind)).toEqual(['main', 'side']);
    expect(view.pots[0].amount).toBe(300);
    expect(view.pots[1].amount).toBe(400);
    expect(view.pots[1].sideIndex).toBe(1);
  });

  it('scales pause with settlement steps', () => {
    expect(settlementPauseMs({ refunds: [], pots: [{ kind: 'main', amount: 10, winners: [] }] })).toBe(
      4800,
    );
    expect(
      settlementPauseMs({
        refunds: [{ seatIndex: 0, amount: 20 }],
        pots: [
          { kind: 'main', amount: 10, winners: [] },
          { kind: 'side', sideIndex: 1, amount: 8, winners: [] },
        ],
      }),
    ).toBe(8000);
  });
});
