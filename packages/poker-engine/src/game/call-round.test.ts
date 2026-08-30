import { describe, it, expect } from 'vitest';
import {
  applyAction,
  createBettingRoundState,
  getValidActions,
  isBettingRoundComplete,
  markBlindPosted,
  nextActiveSeat,
  nextSeatNeedingAction,
  recordPlayerAction,
  resetBettingRound,
  type ActionType,
  type BettingRoundState,
} from './actions.js';
import type { PlayerState } from './settlement.js';
import { assignBlindSeats, firstToActSeat } from './blinds.js';

function player(seat: number, chips = 100): PlayerState {
  return {
    seatIndex: seat,
    userId: `u${seat}`,
    nickname: `P${seat}`,
    chips,
    betThisRound: 0,
    totalBetInHand: 0,
    status: 'ACTIVE',
    holeCards: [],
    isBot: false,
  };
}

function postBlind(p: PlayerState, amount: number) {
  const pay = Math.min(amount, p.chips);
  p.chips -= pay;
  p.betThisRound += pay;
  p.totalBetInHand += pay;
  if (p.chips === 0) p.status = 'ALL_IN';
}

/** Mirrors InteractiveTable.advanceAfterAction + always call/check. */
function playAlwaysCall(seats: number[], buttonSeat: number) {
  const players = seats.map((s) => player(s));
  const { sbSeat, bbSeat } = assignBlindSeats(buttonSeat, seats);
  const betting: BettingRoundState = createBettingRoundState({ bbSeat, minRaise: 2 });
  postBlind(players.find((p) => p.seatIndex === sbSeat)!, 1);
  postBlind(players.find((p) => p.seatIndex === bbSeat)!, 2);
  markBlindPosted(betting, sbSeat);
  markBlindPosted(betting, bbSeat);

  let currentBet = 2;
  let minRaise = 2;
  let currentSeat = firstToActSeat('PRE_FLOP', buttonSeat, bbSeat, players) ?? bbSeat;
  const log: string[] = [];
  let street: 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' = 'PRE_FLOP';

  const needAct = (p: PlayerState) =>
    p.status === 'ACTIVE' && (p.betThisRound !== currentBet || !betting.actedSeats.has(p.seatIndex));

  for (let i = 0; i < 60; i += 1) {
    if (isBettingRoundComplete(players, currentBet, betting)) {
      if (street === 'RIVER') {
        log.push('showdown');
        break;
      }
      const nextStreet = street === 'PRE_FLOP' ? 'FLOP' : street === 'FLOP' ? 'TURN' : 'RIVER';
      log.push(`advance ${street}->${nextStreet}`);
      street = nextStreet;
      for (const p of players) p.betThisRound = 0;
      currentBet = 0;
      minRaise = 2;
      resetBettingRound(betting, 2);
      currentSeat =
        firstToActSeat(street, buttonSeat, bbSeat, players) ?? buttonSeat;
      continue;
    }

    const actor = players.find((p) => p.seatIndex === currentSeat);
    if (!actor || actor.status !== 'ACTIVE') {
      log.push(`dead seat ${currentSeat}`);
      break;
    }

    const valid = getValidActions({
      players,
      currentSeat,
      bigBlind: 2,
      currentBet,
      minRaise,
      raiseClosed: betting.raiseClosedSeats.has(currentSeat),
    });
    const action: ActionType = valid.actions.includes('check')
      ? 'check'
      : valid.actions.includes('call')
        ? 'call'
        : valid.actions.includes('fold')
          ? 'fold'
          : valid.actions[0]!;

    const result = applyAction({
      player: actor,
      action,
      currentBet,
      minRaise,
      raiseClosed: betting.raiseClosedSeats.has(currentSeat),
    });
    Object.assign(actor, result.player);
    currentBet = result.newCurrentBet;
    recordPlayerAction(betting, currentSeat, result.raiseClass);
    log.push(
      `${street} seat${currentSeat} ${action} bet=${actor.betThisRound}/${currentBet} acted=[${[...betting.actedSeats]}]`,
    );

    const sameStreetStillThem =
      !isBettingRoundComplete(players, currentBet, betting) &&
      nextSeatNeedingAction(players, currentSeat, currentBet, betting) === currentSeat;
    if (sameStreetStillThem) {
      log.push('LOOP nextSeatNeedingAction returned same seat');
      break;
    }

    const stillNeed = players.filter(needAct).map((p) => p.seatIndex);
    const next =
      nextSeatNeedingAction(players, currentSeat, currentBet, betting)
      ?? nextActiveSeat(players, currentSeat);
    log.push(`  next=${next} stillNeed=[${stillNeed}]`);
    if (next !== null && next !== currentSeat) currentSeat = next;
  }

  return log;
}

describe('always-call betting does not loop', () => {
  it('HU button=0 reaches flop then river', () => {
    const log = playAlwaysCall([0, 1], 0);
    expect(log.some((l) => l.includes('LOOP'))).toBe(false);
    expect(log.some((l) => l.startsWith('advance PRE_FLOP->FLOP'))).toBe(true);
    expect(log.some((l) => l === 'showdown' || l.startsWith('advance RIVER') || l.includes('showdown'))).toBe(
      true,
    );
  });

  it('3-max button=0 reaches flop', () => {
    const log = playAlwaysCall([0, 1, 2], 0);
    expect(log.some((l) => l.includes('LOOP'))).toBe(false);
    expect(log.some((l) => l.startsWith('advance PRE_FLOP->FLOP'))).toBe(true);
  });

  it('6-max limp around reaches flop', () => {
    const log = playAlwaysCall([0, 1, 2, 3, 4, 5], 3);
    expect(log.some((l) => l.includes('LOOP'))).toBe(false);
    expect(log.some((l) => l.startsWith('advance PRE_FLOP->FLOP'))).toBe(true);
  });
});
