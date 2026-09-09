import { type Card, cardToString, parseCard, rankValue } from '../cards/card.js';
import { createDeck, dealCards, shuffleDeck } from '../cards/deck.js';
import {
  HandCategory,
  compareScores,
  evaluateBestHand,
  type EvaluatedHand,
} from '../eval/hand-evaluator.js';

export const STUD_ANTE_OPTIONS = [1, 2, 5, 10, 20] as const;
export const STUD_MIN_ANTE = 1;

export type StudPhase = 'DECISION' | 'SETTLED';
export type StudOutcome = 'fold' | 'dealer_no_qualify' | 'player_win' | 'dealer_win' | 'push';

export interface StudResult {
  outcome: StudOutcome;
  dealerQualified: boolean;
  playerCategory: string;
  dealerCategory: string;
  anteOdds: number;
  payout: number;
  net: number;
}

export interface StudHand {
  playerCards: Card[];
  dealerCards: Card[];
  community: Card[];
  remaining: Card[];
  ante: number;
  raiseAmount: number;
  phase: StudPhase;
  result: StudResult | null;
}

export interface StudClientView {
  phase: StudPhase;
  ante: number;
  raiseAmount: number;
  raiseToCall: number;
  playerCards: string[];
  dealerCards: string[];
  community: string[];
  result: StudResult | null;
}

export function isAllowedAnte(ante: number): boolean {
  return (STUD_ANTE_OPTIONS as readonly number[]).includes(ante);
}

export function antePayoutOdds(category: HandCategory): number {
  switch (category) {
    case HandCategory.RoyalFlush:
      return 100;
    case HandCategory.StraightFlush:
      return 20;
    case HandCategory.FourOfAKind:
      return 10;
    case HandCategory.FullHouse:
      return 3;
    case HandCategory.Flush:
      return 2;
    default:
      return 1;
  }
}

export const STUD_PAYTABLE = [
  { category: 'ROYAL_FLUSH', odds: 100 },
  { category: 'STRAIGHT_FLUSH', odds: 20 },
  { category: 'FOUR_OF_A_KIND', odds: 10 },
  { category: 'FULL_HOUSE', odds: 3 },
  { category: 'FLUSH', odds: 2 },
] as const;

/** Dealer qualifies with a pair of 4s or better. */
export function dealerQualifies(hand: EvaluatedHand): boolean {
  const { category, kickers } = hand.score;
  if (category > HandCategory.OnePair) return true;
  if (category === HandCategory.OnePair) {
    return (kickers[0] ?? 0) >= rankValue('4');
  }
  return false;
}

export function startStudHand(ante: number, seededDeck?: Card[]): StudHand {
  if (!Number.isInteger(ante) || ante < STUD_MIN_ANTE) {
    throw new Error('INVALID_ANTE');
  }
  if (!isAllowedAnte(ante)) {
    throw new Error('INVALID_ANTE');
  }
  const deck = seededDeck ? [...seededDeck] : shuffleDeck(createDeck());
  const player = dealCards(deck, 2);
  const dealer = dealCards(player.remaining, 2);
  const flop = dealCards(dealer.remaining, 3);
  return {
    playerCards: player.dealt,
    dealerCards: dealer.dealt,
    community: flop.dealt,
    remaining: flop.remaining,
    ante,
    raiseAmount: 0,
    phase: 'DECISION',
    result: null,
  };
}

export function foldStudHand(hand: StudHand): StudHand {
  if (hand.phase !== 'DECISION') throw new Error('HAND_NOT_OPEN');
  return {
    ...hand,
    phase: 'SETTLED',
    result: {
      outcome: 'fold',
      dealerQualified: false,
      playerCategory: '',
      dealerCategory: '',
      anteOdds: 0,
      payout: 0,
      net: -hand.ante,
    },
  };
}

export function raiseStudHand(hand: StudHand): StudHand {
  if (hand.phase !== 'DECISION') throw new Error('HAND_NOT_OPEN');
  const raiseAmount = hand.ante * 2;
  const street = dealCards(hand.remaining, 2);
  const community = [...hand.community, ...street.dealt];
  const playerEval = evaluateBestHand([...hand.playerCards, ...community]);
  const dealerEval = evaluateBestHand([...hand.dealerCards, ...community]);
  const qualified = dealerQualifies(dealerEval);
  const cmp = compareScores(playerEval.score, dealerEval.score);

  let outcome: StudOutcome;
  let anteOdds = 0;
  let payout = 0;

  if (!qualified) {
    outcome = 'dealer_no_qualify';
    anteOdds = 1;
    payout = hand.ante * 2 + raiseAmount;
  } else if (cmp > 0) {
    outcome = 'player_win';
    anteOdds = antePayoutOdds(playerEval.score.category);
    payout = hand.ante * (1 + anteOdds) + raiseAmount * 2;
  } else if (cmp < 0) {
    outcome = 'dealer_win';
    payout = 0;
  } else {
    outcome = 'push';
    payout = hand.ante + raiseAmount;
  }

  const net = payout - hand.ante - raiseAmount;
  return {
    ...hand,
    community,
    remaining: street.remaining,
    raiseAmount,
    phase: 'SETTLED',
    result: {
      outcome,
      dealerQualified: qualified,
      playerCategory: playerEval.categoryName,
      dealerCategory: dealerEval.categoryName,
      anteOdds,
      payout,
      net,
    },
  };
}

export function toStudClientView(hand: StudHand): StudClientView {
  const reveal = hand.phase === 'SETTLED' && hand.result?.outcome !== 'fold';
  const community = [
    ...hand.community.map(cardToString),
    ...Array.from({ length: Math.max(0, 5 - hand.community.length) }, () => ''),
  ];
  return {
    phase: hand.phase,
    ante: hand.ante,
    raiseAmount: hand.raiseAmount,
    raiseToCall: hand.ante * 2,
    playerCards: hand.playerCards.map(cardToString),
    dealerCards: reveal ? hand.dealerCards.map(cardToString) : ['**', '**'],
    community,
    result: hand.result,
  };
}

export function serializeStudHand(hand: StudHand): {
  playerCards: string[];
  dealerCards: string[];
  community: string[];
  remaining: string[];
  ante: number;
  raiseAmount: number;
  phase: StudPhase;
  result: StudResult | null;
} {
  return {
    playerCards: hand.playerCards.map(cardToString),
    dealerCards: hand.dealerCards.map(cardToString),
    community: hand.community.map(cardToString),
    remaining: hand.remaining.map(cardToString),
    ante: hand.ante,
    raiseAmount: hand.raiseAmount,
    phase: hand.phase,
    result: hand.result,
  };
}

export function parseStudHand(raw: {
  playerCards: string[];
  dealerCards: string[];
  community: string[];
  remaining: string[];
  ante: number;
  raiseAmount: number;
  phase: StudPhase;
  result: StudResult | null;
}): StudHand {
  return {
    playerCards: raw.playerCards.map(parseCard),
    dealerCards: raw.dealerCards.map(parseCard),
    community: raw.community.map(parseCard),
    remaining: raw.remaining.map(parseCard),
    ante: raw.ante,
    raiseAmount: raw.raiseAmount,
    phase: raw.phase,
    result: raw.result,
  };
}
