import { describe, it, expect } from 'vitest';
import { HandRunner } from '../game/hand-runner.js';

describe('HandRunner', () => {
  it('runs a heads-up hand to completion', () => {
    const runner = new HandRunner({ smallBlind: 1, bigBlind: 2 });
    runner.initPlayers([
      { seatIndex: 0, userId: 'u1', nickname: 'Alice', chips: 100, isBot: true },
      { seatIndex: 1, userId: 'u2', nickname: 'Bob', chips: 100, isBot: true },
    ]);
    const result = runner.runToCompletion('H001');
    expect(result.phase).toBe('END_HAND');
    expect(result.settlement).not.toBeNull();
    const totalChips = result.players.reduce((s, p) => s + p.chips, 0);
    const rake = result.settlement?.totalRake ?? 0;
    expect(totalChips + rake).toBe(200);
  });

  it('runs 9-max table', () => {
    const runner = new HandRunner({ maxSeats: 9 });
    const specs = Array.from({ length: 9 }, (_, i) => ({
      seatIndex: i,
      userId: `u${i}`,
      nickname: `Player${i}`,
      chips: 100,
      isBot: true,
    }));
    runner.initPlayers(specs);
    const result = runner.runToCompletion('H009');
    expect(result.players).toHaveLength(9);
    expect(result.log.some((e) => e.type === 'HAND_START')).toBe(true);
    expect(result.log.some((e) => e.type === 'HAND_END')).toBe(true);
  });
});
