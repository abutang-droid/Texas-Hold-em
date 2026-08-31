import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MIN_PUBLIC_TABLES, targetPublicTableCount } from '@texas-holdem/shared';
import { InteractiveTable } from './game/interactive-table.js';
import { ensurePublicTables, pickJoinableTable } from './public-lobby.js';

describe('public lobby pool', () => {
  it('keeps 9 tables until real users exceed a multiple of 6', () => {
    assert.equal(targetPublicTableCount(0), MIN_PUBLIC_TABLES);
    assert.equal(targetPublicTableCount(6), 9);
    assert.equal(targetPublicTableCount(7), 10);
    assert.equal(targetPublicTableCount(12), 10);
    assert.equal(targetPublicTableCount(13), 11);
  });

  it('provisions the floor of 9 official tables with bots', async () => {
    const rooms = new Map<string, InteractiveTable>();
    const list = await ensurePublicTables(rooms, async (roomId) => {
      const table = new InteractiveTable(roomId);
      rooms.set(roomId, table);
      return table;
    });
    assert.equal(list.length, 9);
    assert.ok(list.every((row) => row.bots >= 3));
    assert.ok(list.every((row) => row.joinable));
  });

  it('assigns a table that still has an empty seat', async () => {
    const rooms = new Map<string, InteractiveTable>();
    await ensurePublicTables(rooms, async (roomId) => {
      const table = new InteractiveTable(roomId);
      rooms.set(roomId, table);
      return table;
    });
    const picked = pickJoinableTable(rooms);
    assert.ok(picked);
    assert.ok(picked.emptySeatIndexes().length > 0);
  });
});
