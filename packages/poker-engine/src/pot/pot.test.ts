import { describe, it, expect } from 'vitest';
import { calculateSidePots } from '../pot/side-pot.js';
import { calculateRake, OFFICIAL_RAKE_RATE } from '../pot/rake.js';

describe('side-pot', () => {
  it('single main pot', () => {
    const pots = calculateSidePots([
      { seatIndex: 0, totalBet: 20, isFolded: false, isAllIn: false },
      { seatIndex: 1, totalBet: 20, isFolded: false, isAllIn: false },
    ]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(40);
    expect(pots[0].eligibleSeatIndices).toEqual([0, 1]);
  });

  it('side pot with all-in', () => {
    const pots = calculateSidePots([
      { seatIndex: 0, totalBet: 10, isFolded: false, isAllIn: true },
      { seatIndex: 1, totalBet: 30, isFolded: false, isAllIn: false },
      { seatIndex: 2, totalBet: 30, isFolded: false, isAllIn: false },
    ]);
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(30);
    expect(pots[1].amount).toBe(40);
    expect(pots[0].eligibleSeatIndices.sort()).toEqual([0, 1, 2]);
    expect(pots[1].eligibleSeatIndices.sort()).toEqual([1, 2]);
  });

  it('excludes folded from eligibility', () => {
    const pots = calculateSidePots([
      { seatIndex: 0, totalBet: 20, isFolded: true, isAllIn: false },
      { seatIndex: 1, totalBet: 20, isFolded: false, isAllIn: false },
    ]);
    expect(pots[0].eligibleSeatIndices).toEqual([1]);
    expect(pots[0].amount).toBe(40);
  });
});

describe('rake', () => {
  it('no flop no drop', () => {
    const r = calculateRake({ totalPot: 100, reachedFlop: false, rakeRate: OFFICIAL_RAKE_RATE });
    expect(r.rakeAmount).toBe(0);
    expect(r.distributablePot).toBe(100);
  });

  it('5% floor', () => {
    const r = calculateRake({ totalPot: 25, reachedFlop: true, rakeRate: 0.05 });
    expect(r.rakeAmount).toBe(1);
    expect(r.distributablePot).toBe(24);
  });

  it('large pot no cap', () => {
    const r = calculateRake({ totalPot: 10000, reachedFlop: true, rakeRate: 0.05 });
    expect(r.rakeAmount).toBe(500);
  });
});
