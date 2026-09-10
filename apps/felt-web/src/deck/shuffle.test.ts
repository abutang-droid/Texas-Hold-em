import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cardId, createDeck } from './index';
import { shuffleDeck } from './shuffle';

describe('Fisher-Yates shuffle', () => {
  it('keeps 52 unique cards', () => {
    const shuffled = shuffleDeck(createDeck());
    assert.equal(shuffled.length, 52);
    const ids = new Set(shuffled.map(cardId));
    assert.equal(ids.size, 52);
  });

  it('is a permutation of the source deck', () => {
    const source = createDeck();
    const shuffled = shuffleDeck(source);
    const src = [...source.map(cardId)].sort();
    const out = [...shuffled.map(cardId)].sort();
    assert.deepEqual(out, src);
    assert.notDeepEqual(
      shuffled.map(cardId),
      source.map(cardId),
      'shuffle should change order (extremely unlikely to match)',
    );
  });

  it('does not mutate the original array', () => {
    const source = createDeck();
    const snapshot = source.map(cardId).join(',');
    shuffleDeck(source);
    assert.equal(source.map(cardId).join(','), snapshot);
  });
});
