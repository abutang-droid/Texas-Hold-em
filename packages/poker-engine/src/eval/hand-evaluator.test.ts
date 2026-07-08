import { describe, it, expect } from 'vitest';
import { parseCard } from '../cards/card.js';
import { evaluateBestHand, compareScores, HandCategory } from '../eval/hand-evaluator.js';

describe('hand-evaluator', () => {
  it('detects royal flush', () => {
    const hand = evaluateBestHand([
      parseCard('As'), parseCard('Ks'),
      parseCard('Qs'), parseCard('Js'), parseCard('Ts'),
    ]);
    expect(hand.categoryName).toBe('ROYAL_FLUSH');
  });

  it('detects full house', () => {
    const hand = evaluateBestHand([
      parseCard('Ah'), parseCard('Ad'),
      parseCard('Ac'), parseCard('Ks'), parseCard('Kh'),
    ]);
    expect(hand.categoryName).toBe('FULL_HOUSE');
  });

  it('evaluates best 5 from 7', () => {
    const hand = evaluateBestHand([
      parseCard('Ah'), parseCard('Kh'),
      parseCard('Qh'), parseCard('Jh'), parseCard('Th'),
      parseCard('2c'), parseCard('3d'),
    ]);
    expect(hand.categoryName).toBe('ROYAL_FLUSH');
  });

  it('compares kickers', () => {
    const pairAces = evaluateBestHand([
      parseCard('Ah'), parseCard('Ad'),
      parseCard('Kc'), parseCard('Qd'), parseCard('Js'),
    ]);
    const pairKings = evaluateBestHand([
      parseCard('Kh'), parseCard('Kd'),
      parseCard('Ac'), parseCard('Qd'), parseCard('Js'),
    ]);
    expect(compareScores(pairAces.score, pairKings.score)).toBeGreaterThan(0);
  });

  it('detects wheel straight', () => {
    const hand = evaluateBestHand([
      parseCard('As'), parseCard('2h'),
      parseCard('3d'), parseCard('4c'), parseCard('5s'),
    ]);
    expect(hand.score.category).toBe(HandCategory.Straight);
    expect(hand.score.kickers[0]).toBe(3);
  });
});
