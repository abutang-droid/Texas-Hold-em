import { RANKS, SUITS, type PlayingCard } from './types';

/** Standard 52-card French deck. */
export function createDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}
