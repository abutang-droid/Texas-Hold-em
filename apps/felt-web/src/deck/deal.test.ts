import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { burnAndDeal, createDeck, dealCards, dealHoleRound } from './index';

describe('deal', () => {
  it('deals from the front and leaves the rest', () => {
    const deck = createDeck();
    const { dealt, remaining } = dealCards(deck, 5);
    assert.equal(dealt.length, 5);
    assert.equal(remaining.length, 47);
    assert.deepEqual(dealt[0], deck[0]);
    assert.deepEqual(remaining[0], deck[5]);
  });

  it('burns one then deals the street', () => {
    const deck = createDeck();
    const { burned, dealt, remaining } = burnAndDeal(deck, 3);
    assert.deepEqual(burned, deck[0]);
    assert.equal(dealt.length, 3);
    assert.equal(remaining.length, 48);
  });

  it('deals one hole card per seat', () => {
    const { holes, remaining } = dealHoleRound(createDeck(), 6);
    assert.equal(holes.length, 6);
    assert.equal(remaining.length, 46);
  });

  it('throws when the deck is short', () => {
    assert.throws(() => dealCards(createDeck().slice(0, 2), 3), /Not enough cards/);
  });
});
