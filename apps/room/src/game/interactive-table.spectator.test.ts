import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InteractiveTable, type HandEndSummary } from './interactive-table.js';

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

  it('defers stand-up while the player is in a live pot', () => {
    const table = new InteractiveTable('O8');
    table.addPlayer('u1', 'Alice', 100);
    const live = table.getPublicState('u1');
    assert.ok(['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'].includes(live.phase));
    const result = table.standUp('u1');
    assert.equal(result.ok, true);
    assert.equal(result.deferred, true);
    assert.equal(table.hasPlayer('u1'), true);
    assert.equal(table.getPublicState('u1').seats.find((s) => s.userId === 'u1')?.status, 'FOLDED');
  });

  it('reveals remaining hole cards after a contested all-in', () => {
    const table = new InteractiveTable('SD1', {
      roomType: 'PRIVATE',
      maxSeats: 6,
      smallBlind: 1,
      bigBlind: 2,
      buyInCap: 100,
    });
    table.addPlayer('u1', 'A', 100);
    table.addPlayer('u2', 'B', 100);
    assert.equal(table.getPublicState('u1').phase, 'PRE_FLOP');

    let safety = 0;
    while (table.getPublicState().phase !== 'END_HAND' && safety < 6) {
      safety += 1;
      const turn = table.getCurrentTurnSeat();
      assert.ok(turn !== null, `expected a turn at step ${safety}`);
      table.act(turn, 'all_in');
    }

    const end = table.getPublicState('u1');
    assert.equal(end.phase, 'END_HAND');
    assert.equal(end.seats.filter((s) => s.holeCards?.[0] && s.holeCards[0] !== '**').length, 2);
    assert.equal(
      table.getPublicState('u2').seats.filter((s) => s.holeCards?.[0] !== '**').length,
      2,
    );
  });

  it('does not reveal the winner when the other player folded', () => {
    const table = new InteractiveTable('SD2', {
      roomType: 'PRIVATE',
      maxSeats: 6,
      smallBlind: 1,
      bigBlind: 2,
      buyInCap: 100,
    });
    table.addPlayer('u1', 'A', 100);
    table.addPlayer('u2', 'B', 100);
    const turn = table.getCurrentTurnSeat();
    assert.ok(turn !== null);
    table.act(turn, 'fold');
    const end = table.getPublicState('u1');
    assert.equal(end.phase, 'END_HAND');
    const folder = end.seats.find((s) => s.seatIndex === turn);
    const winner = end.seats.find((s) => s.seatIndex !== turn);
    assert.ok(folder && winner);
    const asFolder = table.getPublicState(folder.userId);
    const winnerSeen = asFolder.seats.find((s) => s.userId === winner.userId);
    assert.equal(winnerSeen?.holeCards?.[0], '**');
  });

  it('exposes refunds and pot lines after an uneven all-in', () => {
    const table = new InteractiveTable('SD3', {
      roomType: 'PRIVATE',
      maxSeats: 6,
      smallBlind: 1,
      bigBlind: 2,
      buyInCap: 100,
    });
    let summary: HandEndSummary | undefined;
    table.setHandEndHandler((s) => {
      summary = s;
    });
    table.addPlayer('u1', 'Short', 40);
    table.addPlayer('u2', 'Deep', 100);
    let safety = 0;
    while (table.getPublicState().phase !== 'END_HAND' && safety < 6) {
      safety += 1;
      const turn = table.getCurrentTurnSeat();
      assert.ok(turn !== null);
      table.act(turn, 'all_in');
    }
    assert.ok(summary);
    assert.ok(summary.settlement.pots.length >= 1);
    assert.equal(summary.settlement.pots[0].kind, 'main');
    assert.ok(summary.settlement.nextHandIn >= 4800);
    const returned = summary.settlement.refunds.reduce((s, r) => s + r.amount, 0);
    assert.ok(returned > 0);
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
