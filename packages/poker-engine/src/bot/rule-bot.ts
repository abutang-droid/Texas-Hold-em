import type { Card } from '../cards/card.js';
import { rankValue } from '../cards/card.js';
import type { ActionType } from '../game/actions.js';
import type { ValidActions } from '../game/actions.js';

export interface BotDecisionInput {
  holeCards: Card[];
  communityCards: Card[];
  potSize: number;
  toCall: number;
  stack: number;
  bigBlind: number;
  seatIndex: number;
  buttonSeat: number;
  valid: ValidActions;
}

export interface BotDecision {
  action: ActionType;
  amount?: number;
  thinkTimeMs: number;
}

const PREMIUM = new Set(['A', 'K', 'Q', 'J', 'T']);

function handStrengthPreflop(cards: Card[]): number {
  const [a, b] = cards.map((c) => rankValue(c.rank)).sort((x, y) => y - x);
  const suited = cards[0].suit === cards[1].suit;
  let score = a * 2 + b;
  if (cards[0].rank === cards[1].rank) score += 30;
  if (suited) score += 5;
  if (PREMIUM.has(cards[0].rank) && PREMIUM.has(cards[1].rank)) score += 8;
  return score;
}

function handStrengthPostflop(hole: Card[], board: Card[]): number {
  const all = [...hole, ...board];
  const ranks = all.map((c) => rankValue(c.rank));
  const max = Math.max(...ranks);
  const pairs = ranks.filter((r, i) => ranks.indexOf(r) !== i);
  let score = max;
  if (pairs.length > 0) score += 20 + Math.max(...pairs);
  const suited = board.length > 0 && hole.filter((c) => c.suit === board[0].suit).length > 0;
  if (suited) score += 3;
  return score;
}

function positionFactor(seatIndex: number, buttonSeat: number, maxSeats = 9): number {
  const dist = (seatIndex - buttonSeat + maxSeats) % maxSeats;
  if (dist <= 2) return 1.2;
  if (dist <= 5) return 1.0;
  return 0.85;
}

/** Rule-based bot: loose-passive baseline with occasional bluff */
export function decideBotAction(input: BotDecisionInput): BotDecision {
  const { holeCards, communityCards, potSize, toCall, stack, bigBlind, valid } = input;
  const thinkTimeMs = 1000 + Math.floor(Math.random() * 4000);

  // 3-5% intentional mistake
  if (Math.random() < 0.04) {
    if (valid.actions.includes('fold') && toCall > 0) {
      return { action: 'fold', thinkTimeMs: thinkTimeMs + 1000 };
    }
    if (valid.actions.includes('raise')) {
      return { action: 'raise', amount: valid.minRaiseTotal, thinkTimeMs };
    }
  }

  const pos = positionFactor(input.seatIndex, input.buttonSeat);
  const strength = communityCards.length === 0
    ? handStrengthPreflop(holeCards) * pos
    : handStrengthPostflop(holeCards, communityCards) * pos;

  const potOdds = toCall > 0 ? toCall / (potSize + toCall) : 0;
  const threshold = communityCards.length === 0 ? 18 : 22;

  if (toCall === 0) {
    if (strength > threshold + 10 && valid.actions.includes('raise') && stack > bigBlind * 4) {
      const raiseTo = Math.min(valid.maxRaiseTotal, valid.minRaiseTotal + bigBlind * 2);
      return { action: 'raise', amount: raiseTo, thinkTimeMs: thinkTimeMs + 2000 };
    }
    if (valid.actions.includes('check')) {
      return { action: 'check', thinkTimeMs };
    }
  }

  if (toCall > 0) {
    if (strength < threshold - 5 && valid.actions.includes('fold')) {
      return { action: 'fold', thinkTimeMs };
    }
    if (strength > threshold + 15 && valid.actions.includes('raise') && stack > toCall + bigBlind * 3) {
      return { action: 'raise', amount: valid.minRaiseTotal, thinkTimeMs: thinkTimeMs + 3000 };
    }
    if (potOdds < 0.35 || strength >= threshold) {
      if (valid.actions.includes('call')) return { action: 'call', thinkTimeMs };
      if (valid.actions.includes('all_in')) return { action: 'all_in', thinkTimeMs };
    }
    if (valid.actions.includes('fold')) return { action: 'fold', thinkTimeMs };
    if (valid.actions.includes('call')) return { action: 'call', thinkTimeMs };
  }

  if (valid.actions.includes('check')) return { action: 'check', thinkTimeMs };
  if (valid.actions.includes('fold')) return { action: 'fold', thinkTimeMs };
  return { action: 'call', thinkTimeMs };
}
