import { describe, expect, it } from 'vitest';
import { parseCard, type Card } from '../cards/card.js';
import { evaluateBestHand } from '../eval/hand-evaluator.js';
import {
  dealerQualifies,
  foldStudHand,
  raiseStudHand,
  startStudHand,
  toStudClientView,
} from './caribbean-stud.js';

function cards(...codes: string[]): Card[] {
  return codes.map(parseCard);
}

function deckFrom(...codes: string[]): Card[] {
  return cards(...codes);
}

describe('Caribbean Stud', () => {
  it('deals two player, two dealer, three flop and hides the dealer', () => {
    const hand = startStudHand(2);
    expect(hand.playerCards).toHaveLength(2);
    expect(hand.dealerCards).toHaveLength(2);
    expect(hand.community).toHaveLength(3);
    expect(hand.phase).toBe('DECISION');
    const view = toStudClientView(hand);
    expect(view.dealerCards).toEqual(['**', '**']);
    expect(view.community.filter(Boolean)).toHaveLength(3);
    expect(view.raiseToCall).toBe(4);
  });

  it('rejects an ante that is not on the chip rail', () => {
    expect(() => startStudHand(3)).toThrow('INVALID_ANTE');
  });

  it('fold loses only the ante and does not reveal the dealer', () => {
    const settled = foldStudHand(startStudHand(5));
    expect(settled.result?.outcome).toBe('fold');
    expect(settled.result?.net).toBe(-5);
    expect(settled.result?.payout).toBe(0);
    expect(toStudClientView(settled).dealerCards).toEqual(['**', '**']);
  });

  it('returns ante 1x and the raise when the dealer does not qualify', () => {
    // player 2, dealer 2, flop 3, turn+river 2
    const deck = deckFrom(
      'As', 'Kd',
      '2h', '3c',
      'Qs', '9d', '7c',
      'Jh', '8s',
    );
    const settled = raiseStudHand(startStudHand(10, deck));
    expect(settled.result?.dealerQualified).toBe(false);
    expect(settled.result?.outcome).toBe('dealer_no_qualify');
    expect(settled.result?.payout).toBe(40);
    expect(settled.result?.net).toBe(10);
  });

  it('pays ante odds + even raise when the player beats a qualifying dealer', () => {
    const deck = deckFrom(
      'Ah', 'Kh',
      '4s', '4d',
      'Qh', 'Jh', 'Th',
      '2c', '3c',
    );
    const settled = raiseStudHand(startStudHand(10, deck));
    expect(settled.result?.dealerQualified).toBe(true);
    expect(settled.result?.outcome).toBe('player_win');
    expect(settled.result?.playerCategory).toBe('ROYAL_FLUSH');
    expect(settled.result?.anteOdds).toBe(100);
    expect(settled.result?.payout).toBe(10 * 101 + 20 * 2);
    expect(settled.result?.net).toBe(1020);
  });

  it('player loses ante and raise when a qualifying dealer wins', () => {
    const deck = deckFrom(
      '2s', '7d',
      'As', 'Ad',
      'Kc', 'Qh', '9d',
      '5c', '3h',
    );
    const settled = raiseStudHand(startStudHand(5, deck));
    expect(settled.result?.dealerQualified).toBe(true);
    expect(settled.result?.outcome).toBe('dealer_win');
    expect(settled.result?.payout).toBe(0);
    expect(settled.result?.net).toBe(-15);
  });

  it('pushes when both hands tie after the dealer qualifies', () => {
    const deck = deckFrom(
      '4s', '9d',
      '4h', '9c',
      '4d', '4c', 'As',
      'Kd', 'Qh',
    );
    const settled = raiseStudHand(startStudHand(2, deck));
    expect(settled.result?.outcome).toBe('push');
    expect(settled.result?.payout).toBe(6);
    expect(settled.result?.net).toBe(0);
  });

  it('does not qualify a pair of threes', () => {
    const hand = evaluateBestHand(cards('3s', '3d', '9c', '7h', '2d'));
    expect(dealerQualifies(hand)).toBe(false);
  });

  it('qualifies a pair of fours', () => {
    const hand = evaluateBestHand(cards('4s', '4d', '9c', '7h', '2d'));
    expect(dealerQualifies(hand)).toBe(true);
  });
});
