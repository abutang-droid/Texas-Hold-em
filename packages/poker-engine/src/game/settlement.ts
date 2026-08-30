import type { Card } from '../cards/card.js';
import type { EvaluatedHand } from '../eval/hand-evaluator.js';
import { compareScores } from '../eval/hand-evaluator.js';
import type { PotSlice } from '../pot/side-pot.js';
import { calculateRake } from '../pot/rake.js';

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';

export type SeatStatus = 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'SIT_OUT';

export type GamePhase =
  | 'WAITING'
  | 'PRE_FLOP'
  | 'FLOP'
  | 'TURN'
  | 'RIVER'
  | 'SHOWDOWN'
  | 'END_HAND';

export interface PlayerState {
  seatIndex: number;
  userId: string;
  nickname: string;
  chips: number;
  betThisRound: number;
  totalBetInHand: number;
  status: SeatStatus;
  holeCards: Card[];
  isBot: boolean;
  timeBankMs?: number;
}

export interface TableConfig {
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  rakeRate: number;
  roomType: 'OFFICIAL' | 'PRIVATE';
}

export interface ShowdownWinner {
  seatIndex: number;
  winAmount: number;
  hand: EvaluatedHand;
}

export interface SettlementResult {
  winners: ShowdownWinner[];
  potBreakdown: Array<{
    potIndex: number;
    amount: number;
    rake: number;
    winners: Array<{ seatIndex: number; amount: number }>;
  }>;
  totalRake: number;
}

export function distributePotToWinners(
  pots: PotSlice[],
  players: PlayerState[],
  communityCards: Card[],
  evaluate: (cards: Card[]) => EvaluatedHand,
  reachedFlop: boolean,
  rakeRate: number,
  oddChipSeatOrder: number[],
): SettlementResult {
  const totalPot = pots.reduce((s, p) => s + p.amount, 0);
  const { rakeAmount, distributablePot } = calculateRake({ totalPot, reachedFlop, rakeRate });

  const scale = totalPot > 0 ? distributablePot / totalPot : 0;
  const breakdown: SettlementResult['potBreakdown'] = [];
  const winnings = new Map<number, number>();

  pots.forEach((pot, potIndex) => {
    const potDistributable = Math.floor(pot.amount * scale);
    const eligible = pot.eligibleSeatIndices.filter((si) => {
      const p = players.find((pl) => pl.seatIndex === si);
      return p && p.status !== 'FOLDED';
    });

    if (eligible.length === 0) return;

    const evaluations = eligible.map((seatIndex) => {
      const player = players.find((p) => p.seatIndex === seatIndex)!;
      const allCards = [...player.holeCards, ...communityCards];
      return { seatIndex, hand: evaluate(allCards) };
    });

    evaluations.sort((a, b) => compareScores(b.hand.score, a.hand.score));
    const best = evaluations[0].hand.score;
    const potWinners = evaluations.filter((e) => compareScores(e.hand.score, best) === 0);

    let remaining = potDistributable;
    const perWinner = Math.floor(potDistributable / potWinners.length);
    const winnerPayouts: Array<{ seatIndex: number; amount: number }> = [];

    for (const w of potWinners) {
      winnerPayouts.push({ seatIndex: w.seatIndex, amount: perWinner });
      winnings.set(w.seatIndex, (winnings.get(w.seatIndex) ?? 0) + perWinner);
      remaining -= perWinner;
    }

    // Odd chip to first winner in button-left order
    if (remaining > 0) {
      const order = oddChipSeatOrder.filter((si) => potWinners.some((w) => w.seatIndex === si));
      const recipient = order[0] ?? potWinners[0].seatIndex;
      const entry = winnerPayouts.find((w) => w.seatIndex === recipient);
      if (entry) {
        entry.amount += remaining;
        winnings.set(recipient, (winnings.get(recipient) ?? 0) + remaining);
      }
    }

    breakdown.push({
      potIndex,
      amount: pot.amount,
      rake: pot.amount - potDistributable,
      winners: winnerPayouts,
    });
  });

  const winnerList: ShowdownWinner[] = [];
  for (const [seatIndex, winAmount] of winnings) {
    const player = players.find((p) => p.seatIndex === seatIndex)!;
    const hand = evaluate([...player.holeCards, ...communityCards]);
    winnerList.push({ seatIndex, winAmount, hand });
  }

  return {
    winners: winnerList,
    potBreakdown: breakdown,
    totalRake: rakeAmount,
  };
}
