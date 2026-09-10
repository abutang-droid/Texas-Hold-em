import type { PlayingCard } from './types';

export interface DealResult {
  dealt: PlayingCard[];
  remaining: PlayingCard[];
}

export function dealCards(deck: readonly PlayingCard[], count: number): DealResult {
  if (count < 0) throw new Error('count must be >= 0');
  if (deck.length < count) {
    throw new Error(`Not enough cards: need ${count}, have ${deck.length}`);
  }
  return {
    dealt: deck.slice(0, count),
    remaining: deck.slice(count),
  };
}

/** Hold'em street: burn one, then deal `count` community cards. */
export function burnAndDeal(deck: readonly PlayingCard[], count: number): DealResult & { burned: PlayingCard } {
  if (deck.length < count + 1) {
    throw new Error(`Not enough cards to burn and deal ${count}`);
  }
  return {
    burned: deck[0]!,
    dealt: deck.slice(1, 1 + count),
    remaining: deck.slice(1 + count),
  };
}

/** One orbit of hole cards: seat 0..n-1 each receives the next card. */
export function dealHoleRound(
  deck: readonly PlayingCard[],
  seatCount: number,
): { holes: PlayingCard[]; remaining: PlayingCard[] } {
  const { dealt, remaining } = dealCards(deck, seatCount);
  return { holes: dealt, remaining };
}
