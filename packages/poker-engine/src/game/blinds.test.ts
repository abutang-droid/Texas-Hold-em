import { describe, it, expect } from 'vitest';
import {
  assignBlindSeats,
  firstToActSeat,
  seatsClockwiseFromLeftOfButton,
} from './blinds.js';
import type { PlayerState } from './settlement.js';

function p(seat: number, status: PlayerState['status'] = 'ACTIVE'): PlayerState {
  return {
    seatIndex: seat,
    userId: `u${seat}`,
    nickname: `P${seat}`,
    chips: 100,
    betThisRound: 0,
    totalBetInHand: 0,
    status,
    holeCards: [],
    isBot: false,
  };
}

describe('assignBlindSeats', () => {
  it('heads-up: button posts SB', () => {
    expect(assignBlindSeats(0, [0, 1])).toEqual({ sbSeat: 0, bbSeat: 1 });
    expect(assignBlindSeats(1, [0, 1])).toEqual({ sbSeat: 1, bbSeat: 0 });
  });

  it('6-max: SB/BB are left of button', () => {
    expect(assignBlindSeats(0, [0, 1, 2, 3, 4, 5])).toEqual({ sbSeat: 1, bbSeat: 2 });
    expect(assignBlindSeats(4, [0, 1, 2, 3, 4, 5])).toEqual({ sbSeat: 5, bbSeat: 0 });
  });
});

describe('firstToActSeat', () => {
  it('HU preflop: button/SB acts first', () => {
    const players = [p(0), p(1)];
    expect(firstToActSeat('PRE_FLOP', 0, 1, players)).toBe(0);
  });

  it('HU postflop: BB acts first', () => {
    const players = [p(0), p(1)];
    expect(firstToActSeat('FLOP', 0, 1, players)).toBe(1);
  });

  it('6-max preflop: UTG (left of BB) acts first', () => {
    const players = [0, 1, 2, 3, 4, 5].map((s) => p(s));
    expect(firstToActSeat('PRE_FLOP', 0, 2, players)).toBe(3);
  });

  it('6-max postflop: left of button acts first', () => {
    const players = [0, 1, 2, 3, 4, 5].map((s) => p(s));
    expect(firstToActSeat('FLOP', 0, 2, players)).toBe(1);
  });
});

describe('odd chip order', () => {
  it('starts strictly left of button, clockwise', () => {
    expect(seatsClockwiseFromLeftOfButton(0, [0, 1, 2])).toEqual([1, 2, 0]);
    expect(seatsClockwiseFromLeftOfButton(5, [0, 2, 5])).toEqual([0, 2, 5]);
  });
});
