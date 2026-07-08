export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS = ['s', 'h', 'd', 'c'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function parseCard(str: string): Card {
  if (str.length !== 2) {
    throw new Error(`Invalid card: ${str}`);
  }
  const rank = str[0] as Rank;
  const suit = str[1] as Suit;
  if (!RANKS.includes(rank) || !SUITS.includes(suit)) {
    throw new Error(`Invalid card: ${str}`);
  }
  return { rank, suit };
}

export function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank);
}
