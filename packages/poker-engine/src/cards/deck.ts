import { randomInt } from 'node:crypto';
import { type Card, RANKS, SUITS } from './card.js';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle using crypto RNG */
export function shuffleDeck(deck: Card[]): Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function dealCards(deck: Card[], count: number): { dealt: Card[]; remaining: Card[] } {
  if (deck.length < count) {
    throw new Error('Not enough cards in deck');
  }
  return {
    dealt: deck.slice(0, count),
    remaining: deck.slice(count),
  };
}

/** Standard street deal: burn one, then deal `count` community cards. */
export function burnAndDeal(
  deck: Card[],
  count: number,
): { burned: Card; dealt: Card[]; remaining: Card[] } {
  if (deck.length < count + 1) {
    throw new Error('Not enough cards in deck');
  }
  const burned = deck[0];
  const dealt = deck.slice(1, 1 + count);
  return { burned, dealt, remaining: deck.slice(1 + count) };
}
