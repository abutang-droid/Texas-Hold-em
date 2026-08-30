import { describe, it, expect } from 'vitest';
import { parseCard } from '../cards/card.js';
import { decideBotAction } from './rule-bot.js';
import type { ValidActions } from '../game/actions.js';

const checkRaise: ValidActions = {
  actions: ['check', 'raise', 'bet'],
  callAmount: 0,
  minRaiseTotal: 4,
  maxRaiseTotal: 100,
};

const facingBet: ValidActions = {
  actions: ['fold', 'call', 'raise'],
  callAmount: 2,
  minRaiseTotal: 6,
  maxRaiseTotal: 100,
};

function decide(hole: string, toCall: number, valid: ValidActions) {
  const [a, b] = hole.split('');
  return decideBotAction({
    holeCards: [parseCard(`${a}s`), parseCard(`${b}h`)],
    communityCards: [],
    potSize: 3,
    toCall,
    stack: 98,
    bigBlind: 2,
    seatIndex: 1,
    buttonSeat: 0,
    valid,
  });
}

describe('rule bot stays passive', () => {
  it('checks junk when it can', () => {
    let raises = 0;
    for (let i = 0; i < 40; i += 1) {
      if (decide('72', 0, checkRaise).action === 'raise') raises += 1;
    }
    expect(raises).toBeLessThan(8);
  });

  it('calls a min bet with playable junk rather than raising', () => {
    const actions = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      actions.add(decide('T8', 2, facingBet).action);
    }
    expect(actions.has('call')).toBe(true);
    expect(actions.has('raise')).toBe(false);
  });
});
