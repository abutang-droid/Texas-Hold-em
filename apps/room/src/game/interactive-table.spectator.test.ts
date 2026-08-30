import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InteractiveTable } from './interactive-table.js';

describe('official spectator flow', () => {
  it('starts a live 5-bot game when a spectator joins', () => {
    const table = new InteractiveTable('O1');
    table.addSpectator('u1', 'Alice', null);
    table.ensureOfficialGameRunning();

    const state = table.getPublicState('u1');
    assert.equal(state.role, 'spectator');
    assert.equal(state.mySeatIndex, null);
    assert.equal(state.seats.filter((s) => s.isBot).length, 5);
    assert.equal(state.emptySeats.length, 1);
    assert.equal(state.phase, 'PRE_FLOP');
    assert.ok((state.potTotal ?? 0) > 0);
  });

  it('sits a spectator next hand when a hand is already live', () => {
    const table = new InteractiveTable('O2');
    table.addSpectator('u1', 'Alice', null);
    table.ensureOfficialGameRunning();
    const empty = table.emptySeatIndexes()[0];

    const { seat, nextHand } = table.sitDown('u1', 'Alice', 100, null, empty);
    assert.equal(seat, empty);
    assert.equal(nextHand, true);

    const state = table.getPublicState('u1');
    assert.equal(state.role, 'player');
    assert.equal(state.mySeatIndex, empty);
    assert.equal(state.pendingSitIn, true);
    const me = state.seats.find((s) => s.userId === 'u1');
    assert.ok(me);
    assert.equal(me?.status, 'SIT_OUT');
    assert.deepEqual(me?.holeCards, []);
  });

  it('stands up immediately when not in the pot and keeps bots for spectators', () => {
    const table = new InteractiveTable('O3');
    table.addSpectator('u1', 'Alice', null);
    table.ensureOfficialGameRunning();
    const empty = table.emptySeatIndexes()[0];
    table.sitDown('u1', 'Alice', 100, null, empty);

    const result = table.standUp('u1');
    assert.equal(result.ok, true);
    assert.equal(result.deferred, undefined);

    const state = table.getPublicState('u1');
    assert.equal(state.role, 'spectator');
    assert.equal(state.mySeatIndex, null);
    assert.equal(state.seats.some((s) => s.userId === 'u1'), false);
    assert.equal(state.seats.filter((s) => s.isBot).length, 5);
  });

  it('sits immediately when the table is waiting', () => {
    const table = new InteractiveTable('O4');
    table.addSpectator('u1', 'Alice', null);
    const { nextHand, seat } = table.sitDown('u1', 'Alice', 100, null);
    assert.equal(nextHand, false);
    const state = table.getPublicState('u1');
    assert.equal(state.role, 'player');
    assert.equal(state.mySeatIndex, seat);
    assert.equal(state.pendingSitIn, false);
    assert.equal(state.phase, 'PRE_FLOP');
    const me = state.seats.find((s) => s.userId === 'u1');
    assert.equal(me?.status, 'ACTIVE');
    assert.equal(me?.holeCards.length, 2);
  });
});
