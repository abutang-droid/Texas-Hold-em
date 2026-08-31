import { describe, it, expect } from 'vitest';
import { burnAndDeal, createDeck, shuffleDeck } from './deck.js';

describe('deck', () => {
  it('creates 52 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => `${c.rank}${c.suit}`)).size).toBe(52);
  });

  it('burns one then deals community cards', () => {
    const deck = createDeck();
    const flop = burnAndDeal(deck, 3);
    expect(flop.burned).toEqual(deck[0]);
    expect(flop.dealt).toEqual(deck.slice(1, 4));
    expect(flop.remaining).toHaveLength(48);

    const turn = burnAndDeal(flop.remaining, 1);
    expect(turn.dealt).toHaveLength(1);
    expect(turn.remaining).toHaveLength(46);
  });

  it('shuffle keeps 52 cards', () => {
    const shuffled = shuffleDeck(createDeck());
    expect(shuffled).toHaveLength(52);
  });
});
