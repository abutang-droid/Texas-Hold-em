import type { Card } from '../cards/card.js';
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
  maxSeats?: number;
  valid: ValidActions;
}

export interface BotDecision {
  action: ActionType;
  amount?: number;
  thinkTimeMs: number;
}

const PREMIUM_PAIR = new Set(['A', 'K', 'Q', 'J']);

function isPremium(cards: Card[]): boolean {
  if (cards.length < 2) return false;
  const pair = cards[0].rank === cards[1].rank && PREMIUM_PAIR.has(cards[0].rank);
  const ranks = cards.map((c) => c.rank);
  const bigAce = ranks.includes('A') && ranks.some((r) => r === 'K' || r === 'Q');
  return pair || bigAce;
}

function thinkTime(): number {
  return 900 + Math.floor(Math.random() * 1600);
}

/**
 * Official-table bot: check / call by default.
 * Instant re-raises after a human call felt like a 跟注 dead loop.
 */
export function decideBotAction(input: BotDecisionInput): BotDecision {
  const { holeCards, toCall, stack, bigBlind, valid } = input;
  const thinkTimeMs = thinkTime();
  const premium = isPremium(holeCards);

  if (toCall <= 0) {
    if (
      valid.actions.includes('raise') &&
      stack > bigBlind * 8 &&
      ((premium && Math.random() < 0.4) || Math.random() < 0.05)
    ) {
      return { action: 'raise', amount: valid.minRaiseTotal, thinkTimeMs };
    }
    if (valid.actions.includes('check')) return { action: 'check', thinkTimeMs };
  }

  if (toCall > 0) {
    const tooBig = toCall > bigBlind * 8 && !premium;
    if (tooBig && valid.actions.includes('fold')) {
      return { action: 'fold', thinkTimeMs };
    }
    if (premium && valid.actions.includes('raise') && stack > toCall + bigBlind * 6 && Math.random() < 0.2) {
      return { action: 'raise', amount: valid.minRaiseTotal, thinkTimeMs };
    }
    if (valid.actions.includes('call')) return { action: 'call', thinkTimeMs };
    if (valid.actions.includes('all_in') && toCall >= stack) {
      return { action: 'all_in', thinkTimeMs };
    }
    if (valid.actions.includes('fold')) return { action: 'fold', thinkTimeMs };
  }

  if (valid.actions.includes('check')) return { action: 'check', thinkTimeMs };
  if (valid.actions.includes('fold')) return { action: 'fold', thinkTimeMs };
  return { action: 'call', thinkTimeMs };
}
