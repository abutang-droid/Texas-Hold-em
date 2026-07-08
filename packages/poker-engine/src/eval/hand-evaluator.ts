import { type Card, cardToString, rankValue } from '../cards/card.js';

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

export interface HandScore {
  category: HandCategory;
  /** Tiebreakers, highest first */
  kickers: number[];
}

export interface EvaluatedHand {
  score: HandScore;
  bestFive: Card[];
  categoryName: string;
}

const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'HIGH_CARD',
  [HandCategory.OnePair]: 'ONE_PAIR',
  [HandCategory.TwoPair]: 'TWO_PAIR',
  [HandCategory.ThreeOfAKind]: 'THREE_OF_A_KIND',
  [HandCategory.Straight]: 'STRAIGHT',
  [HandCategory.Flush]: 'FLUSH',
  [HandCategory.FullHouse]: 'FULL_HOUSE',
  [HandCategory.FourOfAKind]: 'FOUR_OF_A_KIND',
  [HandCategory.StraightFlush]: 'STRAIGHT_FLUSH',
  [HandCategory.RoyalFlush]: 'ROYAL_FLUSH',
};

export function compareScores(a: HandScore, b: HandScore): number {
  if (a.category !== b.category) {
    return a.category - b.category;
  }
  const len = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluateFive(cards: Card[]): HandScore {
  const values = cards.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  const groups = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const isWheel = values.includes(12) && values.includes(0) && values.includes(1) && values.includes(2) && values.includes(3);
  const straightHigh = (() => {
    if (isWheel) return 3;
    let consecutive = 1;
    for (let i = 1; i < uniqueValues.length; i += 1) {
      if (uniqueValues[i] === uniqueValues[i - 1] - 1) {
        consecutive += 1;
        if (consecutive >= 5) return uniqueValues[i - 4];
      } else if (uniqueValues[i] !== uniqueValues[i - 1]) {
        consecutive = 1;
      }
    }
    return -1;
  })();
  const isStraight = straightHigh >= 0;

  if (isFlush && isStraight) {
    if (straightHigh === 12 && values.includes(12) && values.includes(8)) {
      return { category: HandCategory.RoyalFlush, kickers: [12] };
    }
    return { category: HandCategory.StraightFlush, kickers: [straightHigh] };
  }
  if (groups[0][1] === 4) {
    return { category: HandCategory.FourOfAKind, kickers: [groups[0][0], groups[1][0]] };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { category: HandCategory.FullHouse, kickers: [groups[0][0], groups[1][0]] };
  }
  if (isFlush) {
    return { category: HandCategory.Flush, kickers: values };
  }
  if (isStraight) {
    return { category: HandCategory.Straight, kickers: [straightHigh] };
  }
  if (groups[0][1] === 3) {
    const kickers = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a);
    return { category: HandCategory.ThreeOfAKind, kickers: [groups[0][0], ...kickers] };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = [groups[0][0], groups[1][0]].sort((a, b) => b - a);
    const kicker = groups[2][0];
    return { category: HandCategory.TwoPair, kickers: [...pairs, kicker] };
  }
  if (groups[0][1] === 2) {
    const kickers = groups.slice(1).map((g) => g[0]).sort((a, b) => b - a);
    return { category: HandCategory.OnePair, kickers: [groups[0][0], ...kickers] };
  }
  return { category: HandCategory.HighCard, kickers: values };
}

export function evaluateBestHand(cards: Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`evaluateBestHand requires 5-7 cards, got ${cards.length}`);
  }
  const combos = cards.length === 5 ? [cards] : combinations(cards, 5);
  let best: { score: HandScore; bestFive: Card[] } | null = null;

  for (const five of combos) {
    const score = evaluateFive(five);
    if (!best || compareScores(score, best.score) > 0) {
      best = { score, bestFive: five };
    }
  }

  if (!best) throw new Error('No hand evaluated');
  return {
    score: best.score,
    bestFive: best.bestFive,
    categoryName: CATEGORY_NAMES[best.score.category],
  };
}

export function cardsToString(cards: Card[]): string {
  return cards.map(cardToString).join(' ');
}
