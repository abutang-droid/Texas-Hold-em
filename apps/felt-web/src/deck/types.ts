export const SUITS = ['s', 'h', 'd', 'c'] as const;
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface PlayingCard {
  rank: Rank;
  suit: Suit;
}

export const SUIT_GLYPH: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

export const RANK_LABEL: Record<Rank, string> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  T: '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
};

export function cardId(card: PlayingCard): string {
  return `${card.rank}${card.suit}`;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'h' || suit === 'd';
}
